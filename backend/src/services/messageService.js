const prisma = require('../config/prisma');
const fs = require('fs/promises');
const path = require('path');
const { MESSAGE_UPLOAD_DIR } = require('../config/upload');
const {
  assertMember,
  assertCanSendMessage,
} = require('./conversationService');

function toClientMessage(message, requesterId, clearedAt = null) {
  const { readReceiptVisible, ...clientMessage } = message;
  if (message.senderId === requesterId && !readReceiptVisible) {
    clientMessage.readAt = null;
  }
  if (clientMessage.replyTo) {
    const { createdAt, ...replyTo } = clientMessage.replyTo;
    clientMessage.replyTo = clearedAt && createdAt <= clearedAt ? null : replyTo;
  }
  return clientMessage;
}

async function getMessages(conversationId, userId) {
  const member = await assertMember(conversationId, userId);

  const messages = await prisma.message.findMany({
    where: {
      conversationId,
      ...(member.clearedAt ? { createdAt: { gt: member.clearedAt } } : {}),
    },
    orderBy: { createdAt: 'asc' },
    include: {
      sender: { select: { id: true, name: true, avatarUrl: true } },
      replyTo: {
        select: {
          id: true,
          content: true,
          type: true,
          attachmentName: true,
          attachmentUrl: true,
          senderId: true,
          createdAt: true,
          sender: { select: { id: true, name: true } },
        },
      },
    },
  });
  return messages.map((message) => toClientMessage(message, userId, member.clearedAt));
}

async function getReplyTo(conversationId, replyToId) {
  if (!replyToId) return null;

  const replyTo = await prisma.message.findUnique({
    where: { id: replyToId },
    select: { id: true, conversationId: true },
  });
  if (!replyTo || replyTo.conversationId !== conversationId) {
    const error = new Error('Pesan yang ingin dibalas tidak ditemukan');
    error.status = 404;
    throw error;
  }
  return replyTo.id;
}

async function saveMessage(conversationId, senderId, content, type = 'text', replyToId = null) {
  const member = await assertCanSendMessage(conversationId, senderId);
  const validReplyToId = await getReplyTo(conversationId, replyToId);

  const message = await prisma.message.create({
    data: { conversationId, senderId, content, type, replyToId: validReplyToId },
    include: {
      sender: { select: { id: true, name: true, avatarUrl: true } },
      replyTo: {
        select: {
          id: true,
          content: true,
          type: true,
          attachmentName: true,
          attachmentUrl: true,
          senderId: true,
          createdAt: true,
          sender: { select: { id: true, name: true } },
        },
      },
    },
  });
  return toClientMessage(message, senderId, member.clearedAt);
}

async function saveAttachmentMessage(conversationId, senderId, file, caption, replyToId = null) {
  const member = await assertCanSendMessage(conversationId, senderId);
  const validReplyToId = await getReplyTo(conversationId, replyToId);

  const type = file.mimetype.startsWith('image/')
    ? 'image'
    : file.mimetype.startsWith('video/')
      ? 'video'
      : 'file';
  const message = await prisma.message.create({
    data: {
      conversationId,
      senderId,
      content: caption || null,
      type,
      attachmentUrl: `/uploads/messages/${file.filename}`,
      attachmentName: file.originalname,
      replyToId: validReplyToId,
    },
    include: {
      sender: { select: { id: true, name: true, avatarUrl: true } },
      replyTo: {
        select: {
          id: true,
          content: true,
          type: true,
          attachmentName: true,
          attachmentUrl: true,
          senderId: true,
          createdAt: true,
          sender: { select: { id: true, name: true } },
        },
      },
    },
  });
  return toClientMessage(message, senderId, member.clearedAt);
}

async function markAsRead(messageId, userId, showReadReceipt = true) {
  const message = await prisma.message.findUnique({ where: { id: messageId } });
  if (!message) throw new Error('Pesan tidak ditemukan');

  await assertMember(message.conversationId, userId);

  // Hanya update kalau memang belum dibaca — hindari overwrite readAt yang sudah ada
  if (message.readAt) return message;

  return prisma.message.update({
    where: { id: messageId },
    data: { readAt: new Date(), readReceiptVisible: showReadReceipt },
  });
}

async function deleteMessage(conversationId, messageId, userId) {
  const message = await prisma.message.findUnique({
    where: { id: messageId },
    select: { id: true, conversationId: true, senderId: true, attachmentUrl: true },
  });
  if (!message || message.conversationId !== conversationId) {
    const error = new Error('Pesan tidak ditemukan');
    error.status = 404;
    throw error;
  }

  await assertMember(message.conversationId, userId);
  if (message.senderId !== userId) {
    const error = new Error('Kamu hanya dapat menghapus pesan yang kamu kirim');
    error.status = 403;
    throw error;
  }

  await prisma.message.delete({ where: { id: message.id } });

  if (message.attachmentUrl?.startsWith('/uploads/messages/')) {
    const filePath = path.join(MESSAGE_UPLOAD_DIR, path.basename(message.attachmentUrl));
    try {
      await fs.unlink(filePath);
    } catch (error) {
      if (error.code !== 'ENOENT') console.error(error);
    }
  }

  return { id: message.id, conversationId: message.conversationId };
}

module.exports = {
  getMessages,
  saveMessage,
  saveAttachmentMessage,
  markAsRead,
  deleteMessage,
};
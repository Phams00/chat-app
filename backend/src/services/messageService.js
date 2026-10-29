const prisma = require('../config/prisma');
const { assertMember } = require('./conversationService');

function toClientMessage(message, requesterId) {
  const { readReceiptVisible, ...clientMessage } = message;
  if (message.senderId === requesterId && !readReceiptVisible) {
    clientMessage.readAt = null;
  }
  return clientMessage;
}

async function getMessages(conversationId, userId) {
  await assertMember(conversationId, userId);

  const messages = await prisma.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: 'asc' },
    include: { sender: { select: { id: true, name: true, avatarUrl: true } } },
  });
  return messages.map((message) => toClientMessage(message, userId));
}

async function saveMessage(conversationId, senderId, content, type = 'text') {
  await assertMember(conversationId, senderId);

  const message = await prisma.message.create({
    data: { conversationId, senderId, content, type },
    include: { sender: { select: { id: true, name: true, avatarUrl: true } } },
  });
  return toClientMessage(message, senderId);
}

async function saveAttachmentMessage(conversationId, senderId, file, caption) {
  await assertMember(conversationId, senderId);

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
    },
    include: { sender: { select: { id: true, name: true, avatarUrl: true } } },
  });
  return toClientMessage(message, senderId);
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

module.exports = { getMessages, saveMessage, saveAttachmentMessage, markAsRead };
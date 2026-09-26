const prisma = require('../config/prisma');
const { assertMember } = require('./conversationService');

async function getMessages(conversationId, userId) {
  await assertMember(conversationId, userId);

  return prisma.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: 'asc' },
    include: { sender: { select: { id: true, name: true, avatarUrl: true } } },
  });
}

async function saveMessage(conversationId, senderId, content, type = 'text') {
  await assertMember(conversationId, senderId);

  return prisma.message.create({
    data: { conversationId, senderId, content, type },
    include: { sender: { select: { id: true, name: true, avatarUrl: true } } },
  });
}

async function markAsRead(messageId, userId) {
  const message = await prisma.message.findUnique({ where: { id: messageId } });
  if (!message) throw new Error('Pesan tidak ditemukan');

  await assertMember(message.conversationId, userId);

  // Hanya update kalau memang belum dibaca — hindari overwrite readAt yang sudah ada
  if (message.readAt) return message;

  return prisma.message.update({
    where: { id: messageId },
    data: { readAt: new Date() },
  });
}

module.exports = { getMessages, saveMessage, markAsRead };
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

module.exports = { getMessages, saveMessage };
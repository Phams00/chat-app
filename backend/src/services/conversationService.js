const prisma = require('../config/prisma');

// Cari conversation direct yang sudah ada antara 2 user, atau buat baru
async function getOrCreateDirectConversation(userId, otherUserId) {
  if (typeof otherUserId !== 'string' || !otherUserId.trim()) {
    throw new Error('Kontak tujuan wajib dipilih');
  }
  if (userId === otherUserId) {
    throw new Error('Tidak bisa membuat chat dengan diri sendiri');
  }

  const savedContact = await prisma.contact.findUnique({
    where: { userId_contactUserId: { userId, contactUserId: otherUserId } },
  });
  if (!savedContact) {
    throw new Error('Pengguna ini belum ada di daftar kontak kamu');
  }

  const existing = await prisma.conversation.findFirst({
    where: {
      type: 'direct',
      AND: [
        { members: { some: { userId } } },
        { members: { some: { userId: otherUserId } } },
      ],
    },
    include: { members: true },
  });

  if (existing) return existing;

  const conversation = await prisma.conversation.create({
    data: {
      type: 'direct',
      members: {
        create: [{ userId }, { userId: otherUserId }],
      },
    },
    include: { members: true },
  });

  return conversation;
}

async function listConversations(userId) {
  const memberships = await prisma.conversationMember.findMany({
    where: { userId },
    include: {
      conversation: {
        include: {
          members: {
            include: { user: { select: { id: true, name: true, avatarUrl: true } } },
          },
          messages: { orderBy: { createdAt: 'desc' }, take: 1 },
        },
      },
    },
    orderBy: { conversation: { createdAt: 'desc' } },
  });

  return memberships.map((m) => ({
    conversationId: m.conversation.id,
    type: m.conversation.type,
    isPinned: m.isPinned,
    isArchived: m.isArchived,
    lastMessage: m.conversation.messages[0] || null,
    members: m.conversation.members.map((mem) => mem.user),
  }));
}

// Pastikan user memang anggota conversation sebelum boleh lihat/kirim pesan
async function assertMember(conversationId, userId) {
  const member = await prisma.conversationMember.findUnique({
    where: { conversationId_userId: { conversationId, userId } },
  });
  if (!member) throw new Error('Kamu bukan anggota percakapan ini');
  return member;
}

async function getConversation(conversationId, userId) {
  await assertMember(conversationId, userId);

  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: {
      members: {
        include: { user: { select: { id: true, name: true, avatarUrl: true } } },
      },
    },
  });

  return {
    conversationId: conversation.id,
    type: conversation.type,
    name: conversation.name,
    members: conversation.members.map((m) => m.user),
  };
}

module.exports = { getOrCreateDirectConversation, listConversations, getConversation, assertMember };
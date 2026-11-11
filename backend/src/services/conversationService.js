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
  const [memberships, contacts, incomingContacts] = await Promise.all([
    prisma.conversationMember.findMany({
      where: { userId },
      include: {
        conversation: {
          include: {
            members: {
              include: {
                user: {
                  select: { id: true, name: true, phoneNumber: true, avatarUrl: true },
                },
              },
            },
            messages: { orderBy: { createdAt: 'desc' }, take: 1 },
          },
        },
      },
      orderBy: { conversation: { createdAt: 'desc' } },
    }),
    prisma.contact.findMany({
      where: { userId },
      select: { contactUserId: true },
    }),
    prisma.contact.findMany({
      where: { contactUserId: userId },
      select: { userId: true },
    }),
  ]);
  const contactUserIds = new Set(contacts.map(({ contactUserId }) => contactUserId));
  const incomingUserIds = new Set(incomingContacts.map(({ userId: incomingUserId }) => incomingUserId));
  const otherUserIds = [...new Set(memberships.flatMap(({ conversation }) =>
    conversation.type === 'direct'
      ? conversation.members
        .filter(({ userId: memberUserId }) => memberUserId !== userId)
        .map(({ userId: memberUserId }) => memberUserId)
      : [],
  ))];
  const blocks = otherUserIds.length
    ? await prisma.userBlock.findMany({
      where: {
        OR: [
          { blockerId: userId, blockedUserId: { in: otherUserIds } },
          { blockedUserId: userId, blockerId: { in: otherUserIds } },
        ],
      },
      select: { blockerId: true, blockedUserId: true },
    })
    : [];
  const blockedByMe = new Set(
    blocks.filter(({ blockerId }) => blockerId === userId)
      .map(({ blockedUserId }) => blockedUserId),
  );
  const blockedMe = new Set(
    blocks.filter(({ blockedUserId }) => blockedUserId === userId)
      .map(({ blockerId }) => blockerId),
  );

  return memberships
    .filter((membership) => {
      if (membership.conversation.type !== 'direct') return true;
      const otherMember = membership.conversation.members.find(
        ({ userId: memberUserId }) => memberUserId !== userId,
      );
      return otherMember && (
        contactUserIds.has(otherMember.userId) || incomingUserIds.has(otherMember.userId)
      );
    })
    .map((membership) => {
      const { conversation } = membership;
      const otherMember = conversation.members.find(
        ({ userId: memberUserId }) => memberUserId !== userId,
      );
      const isContactSavedByMe = Boolean(otherMember && contactUserIds.has(otherMember.userId));
      const isContactSavedByOther = Boolean(otherMember && incomingUserIds.has(otherMember.userId));
      const isOutgoingContactRequest = isContactSavedByMe && !isContactSavedByOther;
      const lastMessage = conversation.messages[0];
      const members = conversation.members.map((conversationMember) => {
        if (isOutgoingContactRequest && conversationMember.userId === otherMember?.userId) {
          return {
            ...conversationMember.user,
            name: conversationMember.user.phoneNumber,
            avatarUrl: null,
          };
        }
        const publicMember = { ...conversationMember.user };
        delete publicMember.phoneNumber;
        return publicMember;
      });

      return {
        conversationId: conversation.id,
        type: conversation.type,
        isPinned: membership.isPinned,
        isArchived: membership.isArchived,
        clearedAt: membership.clearedAt,
        isBlockedByMe: Boolean(otherMember && blockedByMe.has(otherMember.userId)),
        isBlockedByOther: Boolean(otherMember && blockedMe.has(otherMember.userId)),
        isContactSavedByMe,
        isContactSavedByOther,
        isIncomingContactRequest: !isContactSavedByMe && isContactSavedByOther,
        isOutgoingContactRequest,
        lastMessage: lastMessage &&
          (!membership.clearedAt || lastMessage.createdAt > membership.clearedAt)
          ? lastMessage
          : null,
        members,
      };
    });
}

async function getLastMessage(conversationId) {
  return prisma.message.findFirst({
    where: { conversationId },
    orderBy: { createdAt: 'desc' },
    include: { sender: { select: { id: true, name: true, avatarUrl: true } } },
  });
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
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: {
      members: {
        include: {
          user: { select: { id: true, name: true, phoneNumber: true, avatarUrl: true } },
        },
      },
    },
  });
  if (!conversation) throw new Error('Percakapan tidak ditemukan');
  const member = conversation.members.find(({ userId: memberUserId }) => memberUserId === userId);
  if (!member) throw new Error('Kamu bukan anggota percakapan ini');
  const otherMember = conversation.members.find(({ userId: memberUserId }) =>
    memberUserId !== userId,
  );
  const contactLinks = conversation.type === 'direct'
    ? await prisma.contact.findMany({
      where: {
        OR: [
          { userId, contactUserId: otherMember?.userId },
          { userId: otherMember?.userId, contactUserId: userId },
        ],
      },
      select: { userId: true },
    })
    : [];
  const isContactSavedByMe = contactLinks.some(({ userId: ownerId }) => ownerId === userId);
  const isContactSavedByOther = contactLinks.some(
    ({ userId: ownerId }) => ownerId === otherMember?.userId,
  );
  const isOutgoingContactRequest = isContactSavedByMe && !isContactSavedByOther;
  const [blockedByMe, blockedByOther] = conversation.type === 'direct' && otherMember
    ? await Promise.all([
      prisma.userBlock.findUnique({
        where: {
          blockerId_blockedUserId: { blockerId: userId, blockedUserId: otherMember.userId },
        },
        select: { blockerId: true },
      }),
      prisma.userBlock.findUnique({
        where: {
          blockerId_blockedUserId: { blockerId: otherMember.userId, blockedUserId: userId },
        },
        select: { blockerId: true },
      }),
    ])
    : [null, null];
  const members = conversation.members.map((conversationMember) => {
    if (isOutgoingContactRequest && conversationMember.userId === otherMember?.userId) {
      return {
        ...conversationMember.user,
        name: conversationMember.user.phoneNumber,
        avatarUrl: null,
      };
    }
    const publicMember = { ...conversationMember.user };
    delete publicMember.phoneNumber;
    return publicMember;
  });

  return {
    conversationId: conversation.id,
    type: conversation.type,
    name: conversation.name,
    members,
    isFavorite: member.isPinned,
    isBlockedByMe: conversation.type === 'direct' && Boolean(blockedByMe),
    isBlockedByOther: conversation.type === 'direct' && Boolean(blockedByOther),
    isContactSavedByMe,
    isContactSavedByOther,
    isIncomingContactRequest: !isContactSavedByMe && isContactSavedByOther,
    isOutgoingContactRequest,
    clearedAt: member.clearedAt,
  };
}

async function assertCanSendMessage(conversationId, userId) {
  const member = await assertMember(conversationId, userId);
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { type: true, members: { select: { userId: true } } },
  });
  if (conversation?.type === 'direct') {
    const otherMember = conversation.members.find(({ userId: memberUserId }) => memberUserId !== userId);
    const block = otherMember
      ? await prisma.userBlock.findFirst({
        where: {
          OR: [
            { blockerId: userId, blockedUserId: otherMember.userId },
            { blockerId: otherMember.userId, blockedUserId: userId },
          ],
        },
        select: { blockerId: true },
      })
      : null;
    if (block) {
      const error = new Error(block.blockerId === userId
        ? 'Kamu memblokir kontak ini dan tidak dapat mengirim pesan.'
        : 'Anda telah diblokir dan tidak dapat mengirim pesan.');
      error.status = 403;
      throw error;
    }
  }
  return member;
}

async function isBlockedBy(blockerId, blockedId) {
  const block = await prisma.userBlock.findUnique({
    where: { blockerId_blockedUserId: { blockerId, blockedUserId: blockedId } },
    select: { blockerId: true },
  });
  return Boolean(block);
}

async function setFavorite(conversationId, userId, isFavorite) {
  if (typeof isFavorite !== 'boolean') {
    const error = new Error('Pilihan favorit tidak valid');
    error.status = 400;
    throw error;
  }
  const member = await assertMember(conversationId, userId);
  await prisma.conversationMember.update({
    where: { id: member.id },
    data: { isPinned: isFavorite },
  });
  return { isFavorite };
}

async function setBlocked(conversationId, userId, isBlocked) {
  if (typeof isBlocked !== 'boolean') {
    const error = new Error('Pilihan blokir tidak valid');
    error.status = 400;
    throw error;
  }
  const member = await assertMember(conversationId, userId);
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { type: true, members: { select: { userId: true } } },
  });
  if (conversation?.type !== 'direct') {
    const error = new Error('Blokir hanya tersedia untuk chat pribadi');
    error.status = 400;
    throw error;
  }
  const otherMember = conversation.members.find(({ userId: memberUserId }) =>
    memberUserId !== userId,
  );
  if (!otherMember) throw new Error('Kontak percakapan tidak ditemukan');

  await prisma.$transaction(async (transaction) => {
    await transaction.conversationMember.update({
      where: { id: member.id },
      data: { isBlocked },
    });
    if (isBlocked) {
      await transaction.userBlock.upsert({
        where: {
          blockerId_blockedUserId: {
            blockerId: userId,
            blockedUserId: otherMember.userId,
          },
        },
        create: {
          blockerId: userId,
          blockedUserId: otherMember.userId,
        },
        update: {},
      });
    } else {
      await transaction.userBlock.deleteMany({
        where: { blockerId: userId, blockedUserId: otherMember.userId },
      });
    }
  });
  const updatedConversation = await getConversation(conversationId, userId);
  return {
    ...updatedConversation,
    otherUserId: updatedConversation.members.find(({ id }) => id !== userId)?.id,
  };
}

async function clearConversation(conversationId, userId) {
  const member = await assertMember(conversationId, userId);
  const clearedAt = new Date();
  await prisma.conversationMember.update({
    where: { id: member.id },
    data: { clearedAt },
  });
  return { conversationId, clearedAt };
}

module.exports = {
  getOrCreateDirectConversation,
  listConversations,
  getLastMessage,
  getConversation,
  assertMember,
  assertCanSendMessage,
  isBlockedBy,
  setFavorite,
  setBlocked,
  clearConversation,
};
const prisma = require('../config/prisma');
const { phoneNumberCandidates } = require('../utils/phoneNumber');

async function addContact(userId, contactPhoneNumber) {
  if (typeof contactPhoneNumber !== 'string' || !contactPhoneNumber.trim()) {
    throw new Error('Nomor telepon wajib diisi');
  }

  const candidates = phoneNumberCandidates(contactPhoneNumber);
  let contactUser = null;
  for (const candidate of candidates) {
    contactUser = await prisma.user.findUnique({ where: { phoneNumber: candidate } });
    if (contactUser) break;
  }

  if (!contactUser) {
    throw new Error('Nomor tidak terdaftar di aplikasi ini');
  }

  if (contactUser.id === userId) {
    throw new Error('Tidak bisa menambahkan diri sendiri sebagai kontak');
  }

  const existing = await prisma.contact.findUnique({
    where: {
      userId_contactUserId: { userId, contactUserId: contactUser.id },
    },
  });

  if (existing) {
    throw new Error('Kontak sudah ditambahkan sebelumnya');
  }
  const isContactSavedByOther = Boolean(await prisma.contact.findUnique({
    where: {
      userId_contactUserId: { userId: contactUser.id, contactUserId: userId },
    },
    select: { id: true },
  }));

  const contact = await prisma.$transaction(async (transaction) => {
    const createdContact = await transaction.contact.create({
      data: { userId, contactUserId: contactUser.id },
    });
    const existingConversation = await transaction.conversation.findFirst({
      where: {
        type: 'direct',
        AND: [
          { members: { some: { userId } } },
          { members: { some: { userId: contactUser.id } } },
        ],
      },
      select: { id: true },
    });
    const conversation = existingConversation || await transaction.conversation.create({
      data: {
        type: 'direct',
        members: { create: [{ userId }, { userId: contactUser.id }] },
      },
      select: { id: true },
    });
    return { ...createdContact, conversationId: conversation.id };
  });

  return {
    id: contact.id,
    conversationId: contact.conversationId,
    isContactSavedByOther,
    contactUser: {
      id: contactUser.id,
      name: isContactSavedByOther ? contactUser.name : contactUser.phoneNumber,
      phoneNumber: contactUser.phoneNumber,
      avatarUrl: isContactSavedByOther ? contactUser.avatarUrl : null,
    },
  };
}

async function listContacts(userId) {
  const [contacts, incomingContacts] = await Promise.all([
    prisma.contact.findMany({
      where: { userId },
      include: {
        contactUser: {
          select: { id: true, name: true, phoneNumber: true, avatarUrl: true },
        },
      },
      orderBy: { addedAt: 'desc' },
    }),
    prisma.contact.findMany({
      where: { contactUserId: userId },
      include: {
        user: {
          select: { id: true, name: true, phoneNumber: true, avatarUrl: true },
        },
      },
      orderBy: { addedAt: 'desc' },
    }),
  ]);

  const incomingUserIds = incomingContacts.map(({ userId: incomingUserId }) => incomingUserId);
  const reciprocalContacts = incomingUserIds.length
    ? await prisma.contact.findMany({
      where: { userId, contactUserId: { in: incomingUserIds } },
      select: { contactUserId: true },
    })
    : [];
  const reciprocalUserIds = new Set(reciprocalContacts.map(({ contactUserId }) => contactUserId));
  const outgoingContactUserIds = contacts.map(({ contactUserId }) => contactUserId);
  const savedByOtherContacts = outgoingContactUserIds.length
    ? await prisma.contact.findMany({
      where: { userId: { in: outgoingContactUserIds }, contactUserId: userId },
      select: { userId: true },
    })
    : [];
  const savedByOtherUserIds = new Set(
    savedByOtherContacts.map(({ userId: contactOwnerId }) => contactOwnerId),
  );
  const contactUserIds = contacts.map(({ contactUserId }) => contactUserId);
  const blockingMemberships = contactUserIds.length
    ? await prisma.userBlock.findMany({
      where: {
        blockerId: { in: contactUserIds },
        blockedUserId: userId,
      },
      select: { blockerId: true },
    })
    : [];
  const blockedByContactUserIds = new Set(
    blockingMemberships.map(({ blockerId }) => blockerId),
  );

  return {
    contacts: contacts.map((contact) => ({
      id: contact.id,
      addedAt: contact.addedAt,
      isContactSavedByOther: savedByOtherUserIds.has(contact.contactUserId),
      isBlockedByOther: blockedByContactUserIds.has(contact.contactUserId),
      contactUser: savedByOtherUserIds.has(contact.contactUserId)
        ? contact.contactUser
        : {
          ...contact.contactUser,
          name: contact.contactUser.phoneNumber,
          avatarUrl: null,
        },
    })),
    incomingRequests: incomingContacts
      .filter(({ userId: incomingUserId }) => !reciprocalUserIds.has(incomingUserId))
      .map((contact) => ({
        id: contact.id,
        addedAt: contact.addedAt,
        contactUser: contact.user,
      })),
  };
}

async function acceptContactRequest(userId, requestUserId) {
  const request = await prisma.contact.findUnique({
    where: {
      userId_contactUserId: { userId: requestUserId, contactUserId: userId },
    },
    include: {
      user: {
        select: { id: true, name: true, phoneNumber: true, avatarUrl: true },
      },
    },
  });
  if (!request) throw new Error('Permintaan kontak tidak ditemukan');

  const existingContact = await prisma.contact.findUnique({
    where: {
      userId_contactUserId: { userId, contactUserId: requestUserId },
    },
    select: { id: true },
  });
  if (existingContact) throw new Error('Kontak sudah disimpan');

  const { contact, conversation } = await prisma.$transaction(async (transaction) => {
    const savedContact = await transaction.contact.create({
      data: { userId, contactUserId: requestUserId },
    });
    const existingConversation = await transaction.conversation.findFirst({
      where: {
        type: 'direct',
        AND: [
          { members: { some: { userId } } },
          { members: { some: { userId: requestUserId } } },
        ],
      },
      select: { id: true },
    });
    const directConversation = existingConversation || await transaction.conversation.create({
      data: {
        type: 'direct',
        members: { create: [{ userId }, { userId: requestUserId }] },
      },
      select: { id: true },
    });
    return { contact: savedContact, conversation: directConversation };
  });

  return {
    id: contact.id,
    addedAt: contact.addedAt,
    conversationId: conversation.id,
    isContactSavedByOther: true,
    contactUser: request.user,
  };
}

async function removeContactRequest(userId, requestUserId) {
  const request = await prisma.contact.findUnique({
    where: {
      userId_contactUserId: { userId: requestUserId, contactUserId: userId },
    },
    select: { id: true },
  });
  if (!request) throw new Error('Permintaan kontak tidak ditemukan');

  const reciprocalContact = await prisma.contact.findUnique({
    where: {
      userId_contactUserId: { userId, contactUserId: requestUserId },
    },
    select: { id: true },
  });
  if (reciprocalContact) throw new Error('Kontak sudah disimpan');

  return prisma.$transaction(async (transaction) => {
    const conversations = await transaction.conversation.findMany({
      where: {
        type: 'direct',
        AND: [
          { members: { some: { userId } } },
          { members: { some: { userId: requestUserId } } },
        ],
      },
      select: { id: true },
    });
    await transaction.contact.delete({ where: { id: request.id } });
    const conversationIds = conversations.map(({ id }) => id);
    if (conversationIds.length) {
      await transaction.conversationMember.deleteMany({
        where: { userId, conversationId: { in: conversationIds } },
      });
    }
    return { contactUserId: requestUserId, conversationIds };
  });
}

async function removeContact(userId, contactUserId) {
  return prisma.$transaction(async (transaction) => {
    const contact = await transaction.contact.findUnique({
      where: { userId_contactUserId: { userId, contactUserId } },
      select: { id: true },
    });
    if (!contact) throw new Error('Kontak tidak ditemukan');

    const conversations = await transaction.conversation.findMany({
      where: {
        type: 'direct',
        AND: [
          { members: { some: { userId } } },
          { members: { some: { userId: contactUserId } } },
        ],
      },
      select: { id: true },
    });

    await transaction.contact.delete({ where: { id: contact.id } });
    const conversationIds = conversations.map(({ id }) => id);
    if (conversationIds.length > 0) {
      await transaction.conversationMember.deleteMany({
        where: { conversationId: { in: conversationIds }, userId },
      });
    }

    return { contactUserId, conversationIds };
  });
}

module.exports = {
  addContact,
  listContacts,
  acceptContactRequest,
  removeContactRequest,
  removeContact,
};
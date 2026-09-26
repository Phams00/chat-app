const prisma = require('../config/prisma');

async function addContact(userId, contactPhoneNumber) {
  const contactUser = await prisma.user.findUnique({
    where: { phoneNumber: contactPhoneNumber },
  });

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

  const contact = await prisma.contact.create({
    data: { userId, contactUserId: contactUser.id },
  });

  return {
    id: contact.id,
    contactUser: {
      id: contactUser.id,
      name: contactUser.name,
      phoneNumber: contactUser.phoneNumber,
      avatarUrl: contactUser.avatarUrl,
    },
  };
}

async function listContacts(userId) {
  const contacts = await prisma.contact.findMany({
    where: { userId },
    include: {
      contactUser: {
        select: { id: true, name: true, phoneNumber: true, avatarUrl: true },
      },
    },
    orderBy: { addedAt: 'desc' },
  });

  return contacts.map((c) => ({
    id: c.id,
    addedAt: c.addedAt,
    contactUser: c.contactUser,
  }));
}

module.exports = { addContact, listContacts };
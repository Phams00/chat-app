const fs = require('fs/promises');
const path = require('path');
const prisma = require('../config/prisma');
const { STATUS_DIR } = require('../config/upload');
const { isBlockedBy } = require('./conversationService');

function statusError(message, status = 400) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function presentStatus(status) {
  return {
    id: status.id,
    content: status.content,
    mediaUrl: status.mediaUrl ? `/api/statuses/${status.id}/media` : null,
    mediaType: status.mediaType,
    createdAt: status.createdAt,
    expiresAt: status.expiresAt,
  };
}

async function getStatusAudience(userId) {
  const owner = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      avatarUrl: true,
      contactOf: { select: { userId: true } },
      contacts: { select: { contactUserId: true } },
    },
  });
  if (!owner) throw statusError('User tidak ditemukan', 404);

  const { contactOf, contacts, ...user } = owner;
  const savedContactIds = new Set(contacts.map(({ contactUserId }) => contactUserId));
  const visibleContacts = await Promise.all(
    contactOf
      .filter(({ userId: contactOwnerId }) => savedContactIds.has(contactOwnerId))
      .map(async ({ userId: contactOwnerId }) => {
        const [blockedByOwner, blockedByContact] = await Promise.all([
          isBlockedBy(userId, contactOwnerId),
          isBlockedBy(contactOwnerId, userId),
        ]);
        return {
          userId: contactOwnerId,
          isBlocked: blockedByOwner || blockedByContact,
        };
      }),
  );
  return {
    user,
    userIds: [
      userId,
      ...visibleContacts.filter(({ isBlocked }) => !isBlocked).map(({ userId: id }) => id),
    ],
  };
}

async function listStatuses(userId) {
  const contacts = await prisma.contact.findMany({
    where: { userId },
    select: {
      contactUser: {
        select: { id: true, name: true, avatarUrl: true },
      },
    },
  });
  const contactUserIds = contacts.map(({ contactUser }) => contactUser.id);
  const reciprocalContacts = contactUserIds.length
    ? await prisma.contact.findMany({
      where: { userId: { in: contactUserIds }, contactUserId: userId },
      select: { userId: true },
    })
    : [];
  const reciprocalUserIds = new Set(reciprocalContacts.map(({ userId: ownerId }) => ownerId));
  const contactUsersWithBlockStatus = await Promise.all(
    contacts
      .filter(({ contactUser }) => reciprocalUserIds.has(contactUser.id))
      .map(async ({ contactUser }) => {
        const [blockedByOwner, blockedByContact] = await Promise.all([
          isBlockedBy(contactUser.id, userId),
          isBlockedBy(userId, contactUser.id),
        ]);
        return { user: contactUser, isBlocked: blockedByOwner || blockedByContact };
      }),
  );
  const contactUsers = contactUsersWithBlockStatus
    .filter(({ isBlocked }) => !isBlocked)
    .map(({ user }) => user);
  const visibleUserIds = [userId, ...contactUsers.map(({ id }) => id)];
  const statuses = await prisma.status.findMany({
    where: {
      userId: { in: visibleUserIds },
      expiresAt: { gt: new Date() },
    },
    include: {
      user: { select: { id: true, name: true, avatarUrl: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  const mine = statuses.filter((status) => status.userId === userId).map(presentStatus);
  const statusesByUser = new Map();
  for (const status of statuses) {
    if (status.userId === userId) continue;
    const group = statusesByUser.get(status.userId) || [];
    group.push(presentStatus(status));
    statusesByUser.set(status.userId, group);
  }

  return {
    mine,
    contacts: contactUsers
      .filter(({ id }) => statusesByUser.has(id))
      .map((user) => ({ user, statuses: statusesByUser.get(user.id) }))
      .sort((first, second) =>
        new Date(second.statuses[0].createdAt) - new Date(first.statuses[0].createdAt),
      ),
  };
}

async function createStatus(userId, content, file) {
  let status;
  try {
    status = await prisma.status.create({
      data: {
        userId,
        content: content || null,
        mediaUrl: file ? `/uploads/statuses/${file.filename}` : null,
        mediaType: file ? 'image' : 'text',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });
  } catch (err) {
    if (file) {
      try {
        await fs.unlink(file.path);
      } catch (cleanupError) {
        if (cleanupError.code !== 'ENOENT') console.error(cleanupError);
      }
    }
    throw err;
  }

  return presentStatus(status);
}

async function getStatusMediaPath(requesterId, statusId) {
  const status = await prisma.status.findFirst({
    where: { id: statusId, expiresAt: { gt: new Date() } },
    select: { userId: true, mediaUrl: true },
  });
  if (!status || !status.mediaUrl) throw statusError('Status tidak ditemukan', 404);

  if (status.userId !== requesterId) {
    const [blockedByOwner, blockedByRequester] = await Promise.all([
      isBlockedBy(status.userId, requesterId),
      isBlockedBy(requesterId, status.userId),
    ]);
    if (blockedByOwner || blockedByRequester) {
      throw statusError('Kamu tidak dapat melihat status pengguna ini', 403);
    }
    const contactLinks = await prisma.contact.count({
      where: {
        OR: [
          { userId: requesterId, contactUserId: status.userId },
          { userId: status.userId, contactUserId: requesterId },
        ],
      },
    });
    if (contactLinks < 2) throw statusError('Kamu tidak memiliki akses ke status ini', 403);
  }

  return path.join(STATUS_DIR, path.basename(status.mediaUrl));
}

async function deleteStatus(userId, statusId) {
  const status = await prisma.status.findFirst({
    where: { id: statusId, userId },
  });
  if (!status) throw statusError('Status tidak ditemukan', 404);

  await prisma.status.delete({ where: { id: status.id } });
  if (status.mediaUrl) {
    const mediaPath = path.join(STATUS_DIR, path.basename(status.mediaUrl));
    try {
      await fs.unlink(mediaPath);
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
    }
  }
}

module.exports = {
  listStatuses,
  createStatus,
  getStatusMediaPath,
  deleteStatus,
  getStatusAudience,
};

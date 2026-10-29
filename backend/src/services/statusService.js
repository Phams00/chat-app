const fs = require('fs/promises');
const path = require('path');
const prisma = require('../config/prisma');
const { STATUS_DIR } = require('../config/upload');

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

async function listStatuses(userId) {
  const contacts = await prisma.contact.findMany({
    where: { userId },
    select: {
      contactUser: {
        select: { id: true, name: true, avatarUrl: true },
      },
    },
  });
  const contactUsers = contacts.map(({ contactUser }) => contactUser);
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
    const contact = await prisma.contact.findUnique({
      where: {
        userId_contactUserId: {
          userId: requesterId,
          contactUserId: status.userId,
        },
      },
      select: { id: true },
    });
    if (!contact) throw statusError('Kamu tidak memiliki akses ke status ini', 403);
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

module.exports = { listStatuses, createStatus, getStatusMediaPath, deleteStatus };

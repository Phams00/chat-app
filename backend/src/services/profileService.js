const fs = require('fs');
const path = require('path');
const prisma = require('../config/prisma');
const { AVATAR_DIR } = require('../config/upload');

const PROFILE_SELECT = {
  id: true,
  phoneNumber: true,
  name: true,
  username: true,
  about: true,
  avatarUrl: true,
  link: true,
  createdAt: true,
};

const USERNAME_REGEX = /^[a-z0-9_]{3,20}$/;

function fail(message, status = 400) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function normalizeLink(value) {
  const withScheme = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  let url;
  try {
    url = new URL(withScheme);
  } catch {
    throw fail('Link tidak valid');
  }
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw fail('Link harus berawalan http atau https');
  }
  return url.toString();
}

async function getMyProfile(userId) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: PROFILE_SELECT });
  if (!user) throw fail('User tidak ditemukan', 404);
  return user;
}

async function getProfile(requesterId, targetId) {
  const user = await prisma.user.findUnique({ where: { id: targetId }, select: PROFILE_SELECT });
  if (!user) throw fail('User tidak ditemukan', 404);
  if (requesterId === targetId) return user;

  const isContact = await prisma.contact.findUnique({
    where: { userId_contactUserId: { userId: requesterId, contactUserId: targetId } },
  });

  const { phoneNumber, ...publicProfile } = user;
  return isContact ? user : publicProfile;
}

async function updateProfile(userId, input) {
  const data = {}; // whitelist: hanya field di bawah ini yang bisa berubah

  if ('name' in input) {
    const name = String(input.name ?? '').trim();
    if (!name) throw fail('Nama tidak boleh kosong');
    if (name.length > 50) throw fail('Nama maksimal 50 karakter');
    data.name = name;
  }

  if ('username' in input) {
    const raw = String(input.username ?? '').trim().toLowerCase();
    if (raw === '') {
      data.username = null;
    } else {
      if (!USERNAME_REGEX.test(raw)) {
        throw fail('Username 3-20 karakter: huruf kecil, angka, atau underscore');
      }
      const taken = await prisma.user.findFirst({
        where: { username: raw, NOT: { id: userId } },
        select: { id: true },
      });
      if (taken) throw fail('Username sudah dipakai');
      data.username = raw;
    }
  }

  if ('about' in input) {
    const about = String(input.about ?? '').trim();
    if (about.length > 140) throw fail('About maksimal 140 karakter');
    data.about = about || null;
  }

  if ('link' in input) {
    const link = String(input.link ?? '').trim();
    if (link.length > 200) throw fail('Link maksimal 200 karakter');
    data.link = link ? normalizeLink(link) : null;
  }

  if (Object.keys(data).length === 0) throw fail('Tidak ada data yang diubah');

  try {
    return await prisma.user.update({ where: { id: userId }, data, select: PROFILE_SELECT });
  } catch (err) {
    // Jaring pengaman kalau dua orang mengambil username yang sama di detik yang sama
    if (err.code === 'P2002') throw fail('Username sudah dipakai');
    throw err;
  }
}

function removeAvatarFile(avatarUrl) {
  if (!avatarUrl || !avatarUrl.startsWith('/uploads/avatars/')) return;
  // basename mencegah path traversal (misal "../../.env")
  fs.unlink(path.join(AVATAR_DIR, path.basename(avatarUrl)), () => {});
}

async function setAvatar(userId, file) {
  if (!file) throw fail('File foto tidak ditemukan');

  const current = await prisma.user.findUnique({
    where: { id: userId },
    select: { avatarUrl: true },
  });

  const user = await prisma.user.update({
    where: { id: userId },
    data: { avatarUrl: `/uploads/avatars/${file.filename}` },
    select: PROFILE_SELECT,
  });

  removeAvatarFile(current?.avatarUrl); // hapus foto lama supaya disk tidak menumpuk
  return user;
}

async function deleteAvatar(userId) {
  const current = await prisma.user.findUnique({
    where: { id: userId },
    select: { avatarUrl: true },
  });

  const user = await prisma.user.update({
    where: { id: userId },
    data: { avatarUrl: null },
    select: PROFILE_SELECT,
  });

  removeAvatarFile(current?.avatarUrl);
  return user;
}

module.exports = { getMyProfile, getProfile, updateProfile, setAvatar, deleteAvatar };
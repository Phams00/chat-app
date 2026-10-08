//murni logic, tidak ada http request, tidak ada response, tidak ada express, tidak ada router, tidak ada controller

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const prisma = require('../config/prisma');
const { normalizePhoneNumber, phoneNumberCandidates } = require('../utils/phoneNumber');

async function findUserByPhoneNumber(phoneNumber) {
  for (const candidate of phoneNumberCandidates(phoneNumber)) {
    const user = await prisma.user.findUnique({ where: { phoneNumber: candidate } });
    if (user) return user;
  }

  const nationalNumber = normalizePhoneNumber(phoneNumber).slice(3);
  const matches = await prisma.$queryRaw`
    SELECT id
    FROM users
    WHERE regexp_replace(
      regexp_replace(phone_number, '[^0-9]', '', 'g'),
      '^(00|62|0)+',
      ''
    ) = ${nationalNumber}
    LIMIT 2
  `;

  if (matches.length > 1) {
    throw new Error('Nomor ini cocok dengan lebih dari satu akun. Hubungi administrator.');
  }
  if (matches.length === 0) return null;

  return prisma.user.findUnique({ where: { id: matches[0].id } });
}

async function register({ phoneNumber, name, password }) {
  if (typeof name !== 'string' || !name.trim()) {
    throw new Error('Nama wajib diisi');
  }
  if (typeof password !== 'string' || password.length < 6) {
    throw new Error('Kata sandi minimal 6 karakter');
  }

  const normalizedPhoneNumber = normalizePhoneNumber(phoneNumber);
  const existing = await findUserByPhoneNumber(phoneNumber);
  if (existing) {
    throw new Error('Nomor sudah terdaftar');
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { phoneNumber: normalizedPhoneNumber, name: name.trim(), passwordHash },
  });

  return { id: user.id, phoneNumber: user.phoneNumber, name: user.name };
}

async function login({ phoneNumber, password }) {
  if (typeof password !== 'string' || !password) {
    throw new Error('Nomor atau password salah');
  }

  const user = await findUserByPhoneNumber(phoneNumber);
  if (!user) {
    throw new Error('Nomor atau password salah');
  }

  const isValid = await bcrypt.compare(password, user.passwordHash);
  if (!isValid) {
    throw new Error('Nomor atau password salah');
  }

  const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '7d' });
  return { token, user: { id: user.id, name: user.name, phoneNumber: user.phoneNumber } };
}

module.exports = { register, login };
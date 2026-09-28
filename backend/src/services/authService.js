//murni logic, tidak ada http request, tidak ada response, tidak ada express, tidak ada router, tidak ada controller

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const prisma = require('../config/prisma');

async function register({ phoneNumber, name, password }) {
  const existing = await prisma.user.findUnique({ where: { phoneNumber } });
  if (existing) {
    throw new Error('Nomor sudah terdaftar');
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { phoneNumber, name, passwordHash },
  });

  return { id: user.id, phoneNumber: user.phoneNumber, name: user.name };
}

async function login({ phoneNumber, password }) {
  const user = await prisma.user.findUnique({ where: { phoneNumber } });
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
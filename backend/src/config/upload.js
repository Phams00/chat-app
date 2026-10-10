const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');

const UPLOAD_ROOT = path.join(__dirname, '../../uploads');
const AVATAR_DIR = path.join(UPLOAD_ROOT, 'avatars');
const MESSAGE_UPLOAD_DIR = path.join(UPLOAD_ROOT, 'messages');
fs.mkdirSync(AVATAR_DIR, { recursive: true });
fs.mkdirSync(MESSAGE_UPLOAD_DIR, { recursive: true });

// Ekstensi ditentukan SERVER dari mimetype, bukan dari nama file kiriman client
const EXT_BY_MIME = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

const MESSAGE_EXT_BY_MIME = {
  ...EXT_BY_MIME,
  'image/gif': '.gif',
  'application/pdf': '.pdf',
  'text/plain': '.txt',
  'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'application/vnd.ms-excel': '.xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
  'application/vnd.ms-powerpoint': '.ppt',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': '.pptx',
};

const avatarUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, AVATAR_DIR),
    filename: (req, file, cb) =>
      cb(null, `${req.user.id}-${Date.now()}${EXT_BY_MIME[file.mimetype]}`),
  }),
  limits: { fileSize: 2 * 1024 * 1024 }, // 2 MB
  fileFilter: (req, file, cb) => {
    if (EXT_BY_MIME[file.mimetype]) return cb(null, true);
    cb(new Error('Format foto harus JPG, PNG, atau WebP'));
  },
}).single('avatar'); // nama field di form-data

const messageUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, MESSAGE_UPLOAD_DIR),
    filename: (req, file, cb) =>
      cb(null, `${crypto.randomUUID()}${MESSAGE_EXT_BY_MIME[file.mimetype]}`),
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (MESSAGE_EXT_BY_MIME[file.mimetype]) return cb(null, true);
    cb(new Error('Format file tidak didukung. Gunakan gambar, PDF, atau dokumen Office.'));
  },
}).single('file');

module.exports = { UPLOAD_ROOT, AVATAR_DIR, avatarUpload, messageUpload };


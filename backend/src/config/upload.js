const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');

const UPLOAD_ROOT = path.join(__dirname, '../../uploads');
const AVATAR_DIR = path.join(UPLOAD_ROOT, 'avatars');
const MESSAGE_UPLOAD_DIR = path.join(UPLOAD_ROOT, 'messages');
const STATUS_DIR = path.join(UPLOAD_ROOT, 'statuses');
const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024;
const MAX_VIDEO_SIZE = 100 * 1024 * 1024;
fs.mkdirSync(AVATAR_DIR, { recursive: true });
fs.mkdirSync(MESSAGE_UPLOAD_DIR, { recursive: true });
fs.mkdirSync(STATUS_DIR, { recursive: true });

// MIME MP4 generik dinormalisasi sebelum ekstensi file ditentukan.
const EXT_BY_MIME = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

const MESSAGE_EXT_BY_MIME = {
  ...EXT_BY_MIME,
  'image/gif': '.gif',
  'video/mp4': '.mp4',
  'video/webm': '.webm',
  'video/ogg': '.ogv',
  'video/quicktime': '.mov',
  'video/x-m4v': '.m4v',
  'application/pdf': '.pdf',
  'text/plain': '.txt',
  'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'application/vnd.ms-excel': '.xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
  'application/vnd.ms-powerpoint': '.ppt',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': '.pptx',
};

function getMessageMimeType(file) {
  const mimeType = file.mimetype.split(';', 1)[0].trim().toLowerCase();
  if (mimeType === 'application/mp4') return 'video/mp4';
  if (MESSAGE_EXT_BY_MIME[mimeType]) return mimeType;

  const isGenericMimeType = !mimeType || mimeType === 'application/octet-stream';
  if (isGenericMimeType && path.extname(file.originalname).toLowerCase() === '.mp4') {
    return 'video/mp4';
  }

  return null;
}

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
  limits: { fileSize: MAX_VIDEO_SIZE },
  fileFilter: (req, file, cb) => {
    const mimeType = getMessageMimeType(file);
    if (mimeType) {
      file.mimetype = mimeType;
      return cb(null, true);
    }
    cb(new Error('Format file tidak didukung. Gunakan gambar, video, PDF, atau dokumen Office.'));
  },
}).single('file');

const statusUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, STATUS_DIR),
    filename: (req, file, cb) =>
      cb(null, `${crypto.randomUUID()}${EXT_BY_MIME[file.mimetype]}`),
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (EXT_BY_MIME[file.mimetype]) return cb(null, true);
    cb(new Error('Status hanya mendukung gambar JPG, PNG, atau WebP'));
  },
}).single('file');

module.exports = {
  UPLOAD_ROOT,
  AVATAR_DIR,
  STATUS_DIR,
  MAX_ATTACHMENT_SIZE,
  MAX_VIDEO_SIZE,
  avatarUpload,
  messageUpload,
  statusUpload,
};

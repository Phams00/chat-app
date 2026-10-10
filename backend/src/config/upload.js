const fs = require('fs');
const path = require('path');
const multer = require('multer');

const UPLOAD_ROOT = path.join(__dirname, '../../uploads');
const AVATAR_DIR = path.join(UPLOAD_ROOT, 'avatars');
fs.mkdirSync(AVATAR_DIR, { recursive: true });

// Ekstensi ditentukan SERVER dari mimetype, bukan dari nama file kiriman client
const EXT_BY_MIME = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
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

module.exports = { UPLOAD_ROOT, AVATAR_DIR, avatarUpload };
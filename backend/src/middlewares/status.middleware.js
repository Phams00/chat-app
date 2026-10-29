const fs = require('fs');
const { statusUpload } = require('../config/upload');

function uploadStatusMedia(req, res, next) {
  statusUpload(req, res, (err) => {
    if (!err) return next();

    if (err.code === 'LIMIT_FILE_SIZE') err.status = 413;
    else err.status = 400;
    next(err);
  });
}

function validateStatusInput(req, res, next) {
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const content = typeof body.content === 'string' ? body.content.trim() : '';

  if (content.length > 500) {
    if (req.file) {
      fs.unlink(req.file.path, (err) => {
        if (err) console.error(err);
      });
    }
    const err = new Error('Status maksimal 500 karakter');
    err.status = 400;
    return next(err);
  }

  if (!content && !req.file) {
    const validationError = new Error('Tulis status atau pilih gambar terlebih dahulu');
    validationError.status = 400;
    return next(validationError);
  }

  req.statusContent = content;
  next();
}

module.exports = { uploadStatusMedia, validateStatusInput };

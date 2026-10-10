const fs = require('fs');
const profileService = require('../services/profileService');
const { avatarUpload } = require('../config/upload');

function sendError(res, err) {
  res.status(err.status || 400).json({ error: err.message });
}

async function getMe(req, res) {
  try {
    res.json(await profileService.getMyProfile(req.user.id));
  } catch (err) {
    sendError(res, err);
  }
}

async function getProfile(req, res) {
  try {
    res.json(await profileService.getProfile(req.user.id, req.params.id));
  } catch (err) {
    sendError(res, err);
  }
}

async function updateMe(req, res) {
  try {
    res.json(await profileService.updateProfile(req.user.id, req.body));
  } catch (err) {
    sendError(res, err);
  }
}

function uploadAvatar(req, res) {
  avatarUpload(req, res, async (uploadErr) => {
    if (uploadErr) {
      const message =
        uploadErr.code === 'LIMIT_FILE_SIZE' ? 'Ukuran foto maksimal 2 MB' : uploadErr.message;
      return res.status(400).json({ error: message });
    }

    try {
      res.json(await profileService.setAvatar(req.user.id, req.file));
    } catch (err) {
      if (req.file) fs.unlink(req.file.path, () => {}); // jangan tinggalkan file yatim
      sendError(res, err);
    }
  });
}

async function deleteAvatar(req, res) {
  try {
    res.json(await profileService.deleteAvatar(req.user.id));
  } catch (err) {
    sendError(res, err);
  }
}

module.exports = { getMe, getProfile, updateMe, uploadAvatar, deleteAvatar };
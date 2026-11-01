const fs = require('fs');
const conversationService = require('../services/conversationService');
const messageService = require('../services/messageService');
const { assertMember } = conversationService;
const {
  MAX_ATTACHMENT_SIZE,
  MAX_VIDEO_SIZE,
  messageUpload,
} = require('../config/upload');

async function createOrGet(req, res) {
  try {
    const { contactUserId } = req.body;
    const conversation = await conversationService.getOrCreateDirectConversation(
      req.user.id,
      contactUserId
    );
    res.status(201).json(conversation);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function list(req, res) {
  try {
    const conversations = await conversationService.listConversations(req.user.id);
    res.json(conversations);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function getMessages(req, res) {
  try {
    const messages = await messageService.getMessages(req.params.id, req.user.id);
    res.json(messages);
  } catch (err) {
    res.status(403).json({ error: err.message });
  }
}

async function uploadAttachment(req, res) {
  try {
    await assertMember(req.params.id, req.user.id);
  } catch (err) {
    return res.status(403).json({ error: err.message });
  }

  messageUpload(req, res, async (uploadErr) => {
    if (uploadErr) {
      const message =
        uploadErr.code === 'LIMIT_FILE_SIZE'
          ? 'Ukuran unggahan maksimal 100 MB untuk video dan 10 MB untuk file lain'
          : uploadErr.message;
      return res.status(uploadErr.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({ error: message });
    }

    if (!req.file) return res.status(400).json({ error: 'Pilih file yang ingin dikirim' });

    const maxSize = req.file.mimetype.startsWith('video/')
      ? MAX_VIDEO_SIZE
      : MAX_ATTACHMENT_SIZE;
    if (req.file.size > maxSize) {
      fs.unlink(req.file.path, (err) => {
        if (err) console.error(err);
      });
      const maxSizeMb = Math.round(maxSize / (1024 * 1024));
      return res.status(413).json({ error: `Ukuran lampiran maksimal ${maxSizeMb} MB` });
    }

    const caption = String(req.body.caption || '').trim();
    if (caption.length > 1000) {
      fs.unlink(req.file.path, () => {});
      return res.status(400).json({ error: 'Keterangan lampiran maksimal 1000 karakter' });
    }

    try {
      const message = await messageService.saveAttachmentMessage(
        req.params.id,
        req.user.id,
        req.file,
        caption,
      );
      req.app.get('io').to(req.params.id).emit('new_message', message);
      return res.status(201).json(message);
    } catch (err) {
      fs.unlink(req.file.path, () => {});
      return res.status(err.status || 400).json({ error: err.message });
    }
  });
}

async function getOne(req, res) {
  try {
    const conversation = await conversationService.getConversation(req.params.id, req.user.id);
    res.json(conversation);
  } catch (err) {
    res.status(403).json({ error: err.message });
  }
}

module.exports = { createOrGet, list, getMessages, uploadAttachment, getOne };
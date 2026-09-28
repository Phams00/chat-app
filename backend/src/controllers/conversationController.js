const conversationService = require('../services/conversationService');
const messageService = require('../services/messageService');

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

module.exports = { createOrGet, list, getMessages };
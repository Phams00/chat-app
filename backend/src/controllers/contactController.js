const contactService = require('../services/contactService');

async function addContact(req, res) {
  try {
    const { phoneNumber } = req.body;
    const result = await contactService.addContact(req.user.id, phoneNumber);
    const io = req.app.get('io');
    io.to(`user:${req.user.id}`).emit('contact_added', result);
    io.to(`user:${result.contactUser.id}`).emit('contact_request_received');
    io.to(`user:${req.user.id}`).emit('conversation_list_changed');
    io.to(`user:${result.contactUser.id}`).emit('conversation_list_changed');
    io.to(`user:${req.user.id}`).emit('status_access_changed');
    io.to(`user:${result.contactUser.id}`).emit('status_access_changed');
    res.status(201).json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function listContacts(req, res) {
  try {
    const contacts = await contactService.listContacts(req.user.id);
    res.json(contacts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function acceptContactRequest(req, res) {
  try {
    const contact = await contactService.acceptContactRequest(
      req.user.id,
      req.params.contactUserId,
    );
    const io = req.app.get('io');
    io.to(`user:${req.user.id}`).emit('contact_added', contact);
    io.to(`user:${req.user.id}`).emit('conversation_contact_updated', {
      conversationId: contact.conversationId,
    });
    io.to(`user:${req.user.id}`).emit('status_access_changed');
    io.to(`user:${req.params.contactUserId}`).emit('conversation_contact_updated', {
      conversationId: contact.conversationId,
    });
    io.to(`user:${req.params.contactUserId}`).emit('status_access_changed');
    res.status(201).json(contact);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function removeContactRequest(req, res) {
  try {
    const result = await contactService.removeContactRequest(
      req.user.id,
      req.params.contactUserId,
    );
    const io = req.app.get('io');
    io.to(`user:${req.user.id}`).emit('contact_removed', result);
    result.conversationIds.forEach((conversationId) =>
      io.to(`user:${req.user.id}`).emit('conversation_removed', { conversationId }),
    );
    io.to(`user:${req.params.contactUserId}`).emit('contact_removed', {
      contactUserId: req.user.id,
      conversationIds: result.conversationIds,
    });
    io.to(`user:${req.params.contactUserId}`).emit('conversation_list_changed');
    io.to(`user:${req.user.id}`).emit('conversation_list_changed');
    io.to(`user:${req.user.id}`).emit('status_access_changed');
    io.to(`user:${req.params.contactUserId}`).emit('status_access_changed');
    res.status(204).end();
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function removeContact(req, res) {
  try {
    const result = await contactService.removeContact(req.user.id, req.params.contactUserId);
    const userRoom = req.app.get('io').to(`user:${req.user.id}`);
    userRoom.emit('contact_removed', result);
    result.conversationIds.forEach((conversationId) =>
      userRoom.emit('conversation_removed', { conversationId }),
    );
    userRoom.emit('conversation_list_changed');
    userRoom.emit('status_access_changed');
    req.app.get('io')
      .to(`user:${req.params.contactUserId}`)
      .emit('status_access_changed');
    res.status(204).end();
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

module.exports = {
  addContact,
  listContacts,
  acceptContactRequest,
  removeContactRequest,
  removeContact,
};
const contactService = require('../services/contactService');

async function addContact(req, res) {
  try {
    const { phoneNumber } = req.body;
    const result = await contactService.addContact(req.user.id, phoneNumber);
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

module.exports = { addContact, listContacts };
const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/auth.middleware');
const contactController = require('../controllers/contactController');

router.use(authMiddleware); // semua route di bawah ini WAJIB login

router.post('/', contactController.addContact);
router.get('/', contactController.listContacts);
router.post('/:contactUserId/accept', contactController.acceptContactRequest);
router.delete('/:contactUserId/request', contactController.removeContactRequest);
router.delete('/:contactUserId', contactController.removeContact);

module.exports = router;
const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/auth.middleware');
const controller = require('../controllers/conversationController');

router.use(authMiddleware);

router.post('/', controller.createOrGet);
router.get('/', controller.list);
router.get('/:id', controller.getOne);
router.get('/:id/messages', controller.getMessages);
router.post('/:id/messages/attachments', controller.uploadAttachment);

module.exports = router;
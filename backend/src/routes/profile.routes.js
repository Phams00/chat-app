const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/auth.middleware');
const controller = require('../controllers/profileController');

router.use(authMiddleware);

// Urutan penting: '/me' harus di atas '/:id', kalau terbalik "me" dianggap sebagai id
router.get('/me', controller.getMe);
router.patch('/me', controller.updateMe);
router.post('/me/avatar', controller.uploadAvatar);
router.delete('/me/avatar', controller.deleteAvatar);
router.get('/:id', controller.getProfile);

module.exports = router;
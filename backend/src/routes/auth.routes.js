const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const authMiddleware = require('../middlewares/auth.middleware');

router.post('/register', authController.register);
router.post('/login', authController.login);
router.get('/me', authMiddleware, (req, res) => {
    res.json({ userId: req.user.id, message: 'user authenticated'})
});

module.exports = router;
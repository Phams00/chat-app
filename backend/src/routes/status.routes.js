const express = require('express');
const authMiddleware = require('../middlewares/auth.middleware');
const asyncMiddleware = require('../middlewares/async.middleware');
const { uploadStatusMedia, validateStatusInput } = require('../middlewares/status.middleware');
const controller = require('../controllers/statusController');

const router = express.Router();

router.use(authMiddleware);
router.get('/', asyncMiddleware(controller.list));
router.post(
  '/',
  uploadStatusMedia,
  validateStatusInput,
  asyncMiddleware(controller.create),
);
router.get('/:id/media', asyncMiddleware(controller.media));
router.delete('/:id', asyncMiddleware(controller.remove));

module.exports = router;

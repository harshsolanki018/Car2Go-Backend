const express = require('express');
const {
  createMessage,
  listMessages,
  updateMessageStatus,
  deleteMessage,
} = require('../controllers/messages.controller');
const { requireAdmin } = require('../middlewares/auth.middleware');

const router = express.Router();

router.post('/', createMessage);
router.get('/admin/all', requireAdmin, listMessages);
router.patch('/admin/:ticketId/status', requireAdmin, updateMessageStatus);
router.delete('/admin/:ticketId', requireAdmin, deleteMessage);

module.exports = router;

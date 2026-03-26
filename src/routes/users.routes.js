const express = require('express');
const {
  listUsers,
  toggleUserBlock,
  deleteUser,
} = require('../controllers/users.controller');
const { requireAdmin } = require('../middlewares/auth.middleware');

const router = express.Router();

router.get('/', requireAdmin, listUsers);
router.patch('/:id/toggle-block', requireAdmin, toggleUserBlock);
router.delete('/:id', requireAdmin, deleteUser);

module.exports = router;

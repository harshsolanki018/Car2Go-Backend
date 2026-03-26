const express = require('express');
const {
  getAdminStats,
  getAdminDashboard,
} = require('../controllers/stats.controller');
const { requireAdmin } = require('../middlewares/auth.middleware');

const router = express.Router();

router.get('/admin/stats', requireAdmin, getAdminStats);
router.get('/admin/dashboard', requireAdmin, getAdminDashboard);

module.exports = router;

const express = require('express');
const {
  getHomeFeaturedCars,
  getHomeStatusBar,
  getAdminHomeFeaturedCars,
  saveAdminHomeFeaturedCars,
  clearAdminHomeFeaturedCars,
} = require('../controllers/home.controller');
const { requireAdmin } = require('../middlewares/auth.middleware');

const router = express.Router();

router.get('/featured-cars', getHomeFeaturedCars);
router.get('/status-bar', getHomeStatusBar);

router.get('/admin/home-featured-cars', requireAdmin, getAdminHomeFeaturedCars);
router.put(
  '/admin/home-featured-cars',
  requireAdmin,
  saveAdminHomeFeaturedCars
);
router.delete(
  '/admin/home-featured-cars',
  requireAdmin,
  clearAdminHomeFeaturedCars
);

module.exports = router;

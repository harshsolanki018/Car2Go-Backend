const express = require('express');
const { requireAdmin } = require('../middlewares/auth.middleware');
const {
  listAdminBookings,
  approveBooking,
  rejectBooking,
  completeBooking,
  markOwnerPayoutsPaid,
} = require('../controllers/bookings.controller');
const {
  listUsers,
  toggleUserBlock,
  deleteUser,
} = require('../controllers/users.controller');
const {
  listMessages,
  updateMessageStatus,
  deleteMessage,
} = require('../controllers/messages.controller');
const {
  getAdminHomeFeaturedCars,
  saveAdminHomeFeaturedCars,
  clearAdminHomeFeaturedCars,
} = require('../controllers/home.controller');
const { getAdminStats, getAdminDashboard } = require('../controllers/stats.controller');
const {
  listAdminCars,
  approveCar,
  rejectCar,
  blockCar,
  unblockCar,
  deleteCar,
} = require('../controllers/cars.controller');
const { listAdminOwnerPayouts } = require('../controllers/owner-payouts.controller');

const router = express.Router();

router.use(requireAdmin);

router.get('/dashboard', getAdminDashboard);
router.get('/stats', getAdminStats);

router.get('/bookings', listAdminBookings);
router.patch('/bookings/:id/approve', approveBooking);
router.patch('/bookings/:id/reject', rejectBooking);
router.patch('/bookings/:id/complete', completeBooking);
router.patch('/owners/:ownerId/payouts/mark-paid', markOwnerPayoutsPaid);
router.get('/owners/:ownerId/payouts', listAdminOwnerPayouts);

router.get('/users', listUsers);
router.patch('/users/:id/toggle-block', toggleUserBlock);
router.delete('/users/:id', deleteUser);

router.get('/messages', listMessages);
router.patch('/messages/:ticketId/status', updateMessageStatus);
router.delete('/messages/:ticketId', deleteMessage);

router.get('/home-cars', getAdminHomeFeaturedCars);
router.put('/home-cars', saveAdminHomeFeaturedCars);
router.delete('/home-cars', clearAdminHomeFeaturedCars);

router.get('/cars', listAdminCars);
router.patch('/cars/:id/approve', approveCar);
router.patch('/cars/:id/reject', rejectCar);
router.patch('/cars/:id/block', blockCar);
router.patch('/cars/:id/unblock', unblockCar);
router.delete('/cars/:id', deleteCar);

module.exports = router;

const express = require('express');
const {
  createBooking,
  getMyBookings,
  rateMyBooking,
  getBookedRangesForCar,
  listAdminBookings,
  approveBooking,
  rejectBooking,
  completeBooking,
  downloadInvoice,
} = require('../controllers/bookings.controller');
const { requireAuth, requireAdmin } = require('../middlewares/auth.middleware');

const router = express.Router();

router.get('/car/:carId/ranges', requireAuth, getBookedRangesForCar);
router.post('/', requireAuth, (req, res) => {
  res.status(405).json({
    success: false,
    message: 'Booking must be created after payment. Use /payments/verify.',
  });
});
router.get('/me', requireAuth, getMyBookings);
router.get('/:id/invoice', requireAuth, downloadInvoice);
router.patch('/:id/rating', requireAuth, rateMyBooking);

router.get('/admin/all', requireAdmin, listAdminBookings);
router.patch('/admin/:id/approve', requireAdmin, approveBooking);
router.patch('/admin/:id/reject', requireAdmin, rejectBooking);
router.patch('/admin/:id/complete', requireAdmin, completeBooking);

module.exports = router;

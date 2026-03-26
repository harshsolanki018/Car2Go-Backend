const express = require('express');
const { requireAuth } = require('../middlewares/auth.middleware');
const {
  createPaymentOrder,
  reportPaymentFailure,
  verifyPaymentAndCreateBooking,
} = require('../controllers/payments.controller');
const { upload } = require('../config/multer');

const router = express.Router();

router.post('/create-order', requireAuth, createPaymentOrder);
router.post('/failed', requireAuth, reportPaymentFailure);
const bookingUpload = upload.fields([
  { name: 'licenseFront', maxCount: 1 },
  { name: 'licenseBack', maxCount: 1 },
]);
router.post('/verify', requireAuth, bookingUpload, verifyPaymentAndCreateBooking);

module.exports = router;

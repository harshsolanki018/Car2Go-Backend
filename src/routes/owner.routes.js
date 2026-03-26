const express = require('express');
const {
  listOwnerCars,
  getOwnerCarById,
  createOwnerCar,
  updateOwnerCar,
  deleteOwnerCar,
} = require('../controllers/cars.controller');
const {
  listOwnerBookings,
  approveOwnerBooking,
  rejectOwnerBooking,
  completeOwnerBooking,
  verifyOwnerPickupCode,
} = require('../controllers/bookings.controller');
const {
  getOwnerProfile,
  updateOwnerProfile,
} = require('../controllers/owner-profile.controller');
const { listOwnerPayouts } = require('../controllers/owner-payouts.controller');
const { requireOwner } = require('../middlewares/auth.middleware');
const { upload } = require('../config/multer');

const router = express.Router();

router.get('/cars', requireOwner, listOwnerCars);
router.get('/cars/:id', requireOwner, getOwnerCarById);
const carUpload = upload.fields([
  { name: 'image', maxCount: 1 },
  { name: 'ownerLicenseImage', maxCount: 1 },
  { name: 'ownerLicenseFrontImage', maxCount: 1 },
  { name: 'ownerLicenseBackImage', maxCount: 1 },
  { name: 'rcBookImage', maxCount: 1 },
  { name: 'pucCertificateImage', maxCount: 1 },
]);
const profileUpload = upload.fields([
  { name: 'licenseImage', maxCount: 1 },
  { name: 'licenseFrontImage', maxCount: 1 },
  { name: 'licenseBackImage', maxCount: 1 },
]);
router.post('/cars', requireOwner, carUpload, createOwnerCar);
router.put('/cars/:id', requireOwner, carUpload, updateOwnerCar);
router.delete('/cars/:id', requireOwner, deleteOwnerCar);

router.get('/bookings', requireOwner, listOwnerBookings);
router.patch('/bookings/:id/approve', requireOwner, approveOwnerBooking);
router.patch('/bookings/:id/reject', requireOwner, rejectOwnerBooking);
router.patch('/bookings/:id/verify-pickup', requireOwner, verifyOwnerPickupCode);
router.patch('/bookings/:id/complete', requireOwner, completeOwnerBooking);
router.get('/payouts', requireOwner, listOwnerPayouts);

router.get('/profile', requireOwner, getOwnerProfile);
router.put('/profile', requireOwner, profileUpload, updateOwnerProfile);

module.exports = router;


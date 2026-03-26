const express = require('express');
const {
  listCars,
  getCarById,
  createCar,
  updateCar,
  deleteCar,
} = require('../controllers/cars.controller');
const { requireAdmin } = require('../middlewares/auth.middleware');
const { upload } = require('../config/multer');

const router = express.Router();

router.get('/', listCars);
router.get('/:id', getCarById);

const carUpload = upload.fields([
  { name: 'image', maxCount: 1 },
  { name: 'ownerLicenseImage', maxCount: 1 },
  { name: 'ownerLicenseFrontImage', maxCount: 1 },
  { name: 'ownerLicenseBackImage', maxCount: 1 },
  { name: 'rcBookImage', maxCount: 1 },
  { name: 'pucCertificateImage', maxCount: 1 },
]);

router.post('/', requireAdmin, carUpload, createCar);
router.put('/:id', requireAdmin, carUpload, updateCar);
router.delete('/:id', requireAdmin, deleteCar);

module.exports = router;

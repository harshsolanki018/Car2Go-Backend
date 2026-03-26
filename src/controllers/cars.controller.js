const Car = require('../models/car.model');
const Booking = require('../models/booking.model');
const User = require('../models/user.model');
const asyncHandler = require('../utils/async-handler');
const HttpError = require('../utils/http-error');
const { CAR_STATUS, USER_ROLES } = require('../constants/enums');
const { normalizeImageUrl } = require('../utils/normalize-image-url');
const { deleteImages } = require('../services/cloudinary-delete.service');

function isValidPhone(phone) {
  return /^[0-9]{10}$/.test(phone);
}

function getUploadedFile(req, field) {
  const files = req.files || {};
  const entry = files[field];
  if (Array.isArray(entry) && entry.length > 0) {
    return entry[0];
  }
  return null;
}

function getUploadedFiles(req, field) {
  const files = req.files || {};
  const entry = files[field];
  return Array.isArray(entry) ? entry : [];
}

function applyUploadedFile(payload, file, urlField, publicIdField) {
  if (!file) {
    return;
  }
  payload[urlField] = file.path || '';
  payload[publicIdField] = file.filename || '';
}

async function replaceUploadedFile(model, file, urlField, publicIdField) {
  if (!file) {
    return;
  }
  if (model[publicIdField]) {
    await deleteImages([model[publicIdField]]);
  }
  model[urlField] = file.path || '';
  model[publicIdField] = file.filename || '';
}

async function getBlockedOwnerIds() {
  const owners = await User.find({ role: USER_ROLES.OWNER, blocked: true }).select('id');
  return owners.map((owner) => owner.id);
}

function normalizeLocationFields(payload) {
  const locationPayload =
    payload && typeof payload.location === 'object' ? payload.location : null;
  let state = String(locationPayload?.state || payload.state || '').trim();
  let city = String(locationPayload?.city || payload.city || '').trim();
  let area = String(locationPayload?.area || payload.area || '').trim();

  if (!state && !city && !area && typeof payload.location === 'string') {
    const parts = payload.location
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean);
    if (parts.length >= 2) {
      city = parts[0] || '';
      area = parts[1] || '';
      if (parts.length >= 3) {
        state = parts.slice(2).join(', ');
      }
    }
  }

  const location = [city, area, state].filter(Boolean).join(', ');

  return {
    state,
    city,
    area,
    location: location || String(payload.location || '').trim(),
  };
}

function normalizeCarPayload(payload) {
  const locationFields = normalizeLocationFields(payload);
  return {
    ownerName: String(payload.ownerName || '').trim(),
    ownerContact: String(payload.ownerContact || '').trim(),
    ownerLicenseImage: String(payload.ownerLicenseImage || '').trim(),
    ownerLicenseFrontImage: String(payload.ownerLicenseFrontImage || '').trim(),
    ownerLicenseBackImage: String(payload.ownerLicenseBackImage || '').trim(),
    name: String(payload.name || '').trim(),
    carNumber: String(payload.carNumber || '').trim().toUpperCase(),
    image: String(payload.image || '').trim(),
    rcBookImage: String(payload.rcBookImage || '').trim(),
    pucCertificateImage: String(payload.pucCertificateImage || '').trim(),
    state: locationFields.state,
    city: locationFields.city,
    area: locationFields.area,
    location: locationFields.location,
    fuelType: String(payload.fuelType || '').trim(),
    transmission: String(payload.transmission || '').trim(),
    seats: Number(payload.seats),
    pricePerDay: Number(payload.pricePerDay),
    description: String(payload.description || '').trim(),
    status: payload.status ? String(payload.status).trim() : '',
  };
}

function validateCarPayload(car) {
  if (
    !car.ownerName ||
    !car.ownerContact ||
    !car.name ||
    !car.carNumber ||
    !car.state ||
    !car.city ||
    !car.area ||
    !car.location ||
    !car.fuelType ||
    !car.transmission ||
    !car.description ||
    !Number.isFinite(car.seats) ||
    car.seats <= 0 ||
    !Number.isFinite(car.pricePerDay) ||
    car.pricePerDay < 0
  ) {
    throw new HttpError(400, 'Please fill all required fields correctly.');
  }

  if (!isValidPhone(car.ownerContact)) {
    throw new HttpError(400, 'Owner contact number must be 10 digits.');
  }

  const locationPattern = /^[A-Za-z ]+$/;
  if (!locationPattern.test(car.state)) {
    throw new HttpError(400, 'State must contain only letters.');
  }
  if (!locationPattern.test(car.city)) {
    throw new HttpError(400, 'City must contain only letters.');
  }
  if (!locationPattern.test(car.area)) {
    throw new HttpError(400, 'Area must contain only letters.');
  }
}

function validateCarDocuments(car, req, requireDocs = false) {
  const ownerLicenseFrontFile = getUploadedFile(req, 'ownerLicenseFrontImage');
  const ownerLicenseBackFile = getUploadedFile(req, 'ownerLicenseBackImage');
  const rcBookFile = getUploadedFile(req, 'rcBookImage');
  const pucFile = getUploadedFile(req, 'pucCertificateImage');

  if (requireDocs && !car.ownerLicenseFrontImage && !ownerLicenseFrontFile) {
    throw new HttpError(400, 'Owner license front image is required.');
  }
  if (requireDocs && !car.ownerLicenseBackImage && !ownerLicenseBackFile) {
    throw new HttpError(400, 'Owner license back image is required.');
  }
  if (requireDocs && !car.rcBookImage && !rcBookFile) {
    throw new HttpError(400, 'RC book image is required.');
  }
  if (requireDocs && !car.pucCertificateImage && !pucFile) {
    throw new HttpError(400, 'PUC certificate image is required.');
  }
}

function applyOwnerDefaults(carPayload, owner) {
  return {
    ...carPayload,
    ownerId: owner?.id || carPayload.ownerId,
    ownerEmail: owner?.email || carPayload.ownerEmail,
    ownerName: carPayload.ownerName || owner?.name || '',
    ownerContact: carPayload.ownerContact || owner?.phone || '',
    ownerLicenseImage:
      carPayload.ownerLicenseImage || owner?.licenseImage || '',
    ownerLicenseImagePublicId:
      carPayload.ownerLicenseImagePublicId || owner?.licenseImagePublicId || '',
    ownerLicenseFrontImage:
      carPayload.ownerLicenseFrontImage || owner?.licenseFrontImage || owner?.licenseImage || '',
    ownerLicenseFrontImagePublicId:
      carPayload.ownerLicenseFrontImagePublicId ||
      owner?.licenseFrontImagePublicId ||
      owner?.licenseImagePublicId ||
      '',
    ownerLicenseBackImage:
      carPayload.ownerLicenseBackImage || owner?.licenseBackImage || '',
    ownerLicenseBackImagePublicId:
      carPayload.ownerLicenseBackImagePublicId || owner?.licenseBackImagePublicId || '',
  };
}

function sanitizeCarResponse(car, { includeStatus = true } = {}) {
  const data = car?.toObject ? car.toObject() : { ...car };
  delete data.ownerLicenseImage;
  delete data.ownerLicenseFrontImage;
  delete data.ownerLicenseBackImage;
  delete data.rcBookImage;
  delete data.pucCertificateImage;
  delete data.ownerLicenseImagePublicId;
  delete data.ownerLicenseFrontImagePublicId;
  delete data.ownerLicenseBackImagePublicId;
  delete data.rcBookImagePublicId;
  delete data.pucCertificateImagePublicId;
  if (data.image) {
    data.image = normalizeImageUrl(data.image);
  }
  if (!includeStatus) {
    delete data.status;
  }
  return data;
}

function normalizeCarImage(car) {
  const data = car?.toObject ? car.toObject() : { ...car };
  if (data.image) {
    data.image = normalizeImageUrl(data.image);
  }
  return data;
}

async function ensureUniqueCarNumber(carNumber, excludeCarId = null) {
  const existing = await Car.findOne({ carNumber });
  if (!existing) {
    return;
  }

  if (excludeCarId !== null && String(existing.id) === String(excludeCarId)) {
    return;
  }

  throw new HttpError(409, 'Car number already exists. Please enter a unique car number.');
}

const listCars = asyncHandler(async (req, res) => {
  const blockedOwnerIds = await getBlockedOwnerIds();
  const ownerFilter = blockedOwnerIds.length
    ? { ownerId: { $nin: blockedOwnerIds } }
    : {};
  const cars = await Car.find({
    ...ownerFilter,
    status: CAR_STATUS.APPROVED,
  }).sort({ id: -1 });
  const ratings = await Booking.aggregate([
    {
      $match: {
        rating: { $gt: 0 },
      },
    },
    {
      $group: {
        _id: '$carId',
        ratingAvg: { $avg: '$rating' },
        ratingCount: { $sum: 1 },
      },
    },
  ]);

  const ratingMap = new Map(
    ratings.map((item) => [
      String(item._id),
      {
        ratingAvg: Number(item.ratingAvg || 0),
        ratingCount: Number(item.ratingCount || 0),
      },
    ])
  );

  const carsWithRatings = cars.map((car) => {
    const rating = ratingMap.get(car.id);
    return {
      ...sanitizeCarResponse(car, { includeStatus: false }),
      ratingAvg: rating ? Number(rating.ratingAvg.toFixed(1)) : 0,
      ratingCount: rating ? rating.ratingCount : 0,
    };
  });

  res.json({ success: true, data: carsWithRatings });
});

const listOwnerCars = asyncHandler(async (req, res) => {
  const cars = await Car.find({ ownerId: req.user.id }).sort({ id: -1 });
  res.json({ success: true, data: cars.map(sanitizeCarResponse) });
});

const getCarById = asyncHandler(async (req, res) => {
  const carId = String(req.params.id || '').trim();
  const car = await Car.findOne({ id: carId });
  if (!car) {
    throw new HttpError(404, 'Car not found.');
  }
  if (car.status !== CAR_STATUS.APPROVED) {
    throw new HttpError(404, 'Car not found.');
  }
  if (car.ownerId) {
    const owner = await User.findOne({ id: car.ownerId });
    if (owner?.blocked) {
      throw new HttpError(404, 'Car not found.');
    }
  }
  res.json({ success: true, data: sanitizeCarResponse(car, { includeStatus: false }) });
});

const listAdminCars = asyncHandler(async (req, res) => {
  const cars = await Car.find().sort({ id: -1 });
  res.json({ success: true, data: cars.map(normalizeCarImage) });
});

const createCar = asyncHandler(async (req, res) => {
  let carPayload = normalizeCarPayload(req.body);
  validateCarPayload(carPayload);
  validateCarDocuments(carPayload, req, false);
  await ensureUniqueCarNumber(carPayload.carNumber);
  const imageFile = getUploadedFile(req, 'image');
  if (!imageFile) {
    throw new HttpError(400, 'Car image is required.');
  }
  applyUploadedFile(carPayload, imageFile, 'image', 'imagePublicId');
  applyUploadedFile(
    carPayload,
    getUploadedFile(req, 'ownerLicenseImage'),
    'ownerLicenseImage',
    'ownerLicenseImagePublicId'
  );
  applyUploadedFile(
    carPayload,
    getUploadedFile(req, 'ownerLicenseFrontImage'),
    'ownerLicenseFrontImage',
    'ownerLicenseFrontImagePublicId'
  );
  applyUploadedFile(
    carPayload,
    getUploadedFile(req, 'ownerLicenseBackImage'),
    'ownerLicenseBackImage',
    'ownerLicenseBackImagePublicId'
  );
  applyUploadedFile(
    carPayload,
    getUploadedFile(req, 'rcBookImage'),
    'rcBookImage',
    'rcBookImagePublicId'
  );
  applyUploadedFile(
    carPayload,
    getUploadedFile(req, 'pucCertificateImage'),
    'pucCertificateImage',
    'pucCertificateImagePublicId'
  );

  const car = new Car({
    ...carPayload,
    status: CAR_STATUS.APPROVED,
  });

  await car.save();
  res.status(201).json({
    success: true,
    message: 'Car added successfully.',
    data: normalizeCarImage(car),
  });
});

const createOwnerCar = asyncHandler(async (req, res) => {
  let carPayload = normalizeCarPayload(req.body);
  carPayload = applyOwnerDefaults(carPayload, req.user);
  validateCarPayload(carPayload);
  validateCarDocuments(carPayload, req, true);
  await ensureUniqueCarNumber(carPayload.carNumber);
  const imageFile = getUploadedFile(req, 'image');
  if (!imageFile) {
    throw new HttpError(400, 'Car image is required.');
  }
  applyUploadedFile(carPayload, imageFile, 'image', 'imagePublicId');
  const rcBookFile = getUploadedFile(req, 'rcBookImage');
  if (!rcBookFile) {
    throw new HttpError(400, 'RC book image is required.');
  }
  applyUploadedFile(carPayload, rcBookFile, 'rcBookImage', 'rcBookImagePublicId');
  const pucFile = getUploadedFile(req, 'pucCertificateImage');
  if (!pucFile) {
    throw new HttpError(400, 'PUC certificate image is required.');
  }
  applyUploadedFile(
    carPayload,
    pucFile,
    'pucCertificateImage',
    'pucCertificateImagePublicId'
  );

  const car = new Car({
    ...carPayload,
    status: CAR_STATUS.PENDING,
  });

  await car.save();
  res.status(201).json({
    success: true,
    message: 'Car added successfully.',
    data: normalizeCarImage(car),
  });
});

const updateCar = asyncHandler(async (req, res) => {
  const carId = String(req.params.id || '').trim();
  const car = await Car.findOne({ id: carId });
  if (!car) {
    throw new HttpError(404, 'Car not found.');
  }

  const carPayload = normalizeCarPayload(req.body);
  if (!Object.prototype.hasOwnProperty.call(req.body, 'status')) {
    carPayload.status = car.status;
  }
  if (!Object.prototype.hasOwnProperty.call(req.body, 'ownerLicenseImage')) {
    carPayload.ownerLicenseImage = car.ownerLicenseImage || '';
  }
  if (!Object.prototype.hasOwnProperty.call(req.body, 'ownerLicenseFrontImage')) {
    carPayload.ownerLicenseFrontImage = car.ownerLicenseFrontImage || '';
  }
  if (!Object.prototype.hasOwnProperty.call(req.body, 'ownerLicenseBackImage')) {
    carPayload.ownerLicenseBackImage = car.ownerLicenseBackImage || '';
  }
  if (!Object.prototype.hasOwnProperty.call(req.body, 'rcBookImage')) {
    carPayload.rcBookImage = car.rcBookImage || '';
  }
  if (!Object.prototype.hasOwnProperty.call(req.body, 'pucCertificateImage')) {
    carPayload.pucCertificateImage = car.pucCertificateImage || '';
  }
  validateCarPayload(carPayload);
  validateCarDocuments(carPayload, req, false);
  await ensureUniqueCarNumber(carPayload.carNumber, carId);
  carPayload.imagePublicId = car.imagePublicId || '';
  carPayload.ownerLicenseImagePublicId = car.ownerLicenseImagePublicId || '';
  carPayload.ownerLicenseFrontImagePublicId = car.ownerLicenseFrontImagePublicId || '';
  carPayload.ownerLicenseBackImagePublicId = car.ownerLicenseBackImagePublicId || '';
  carPayload.rcBookImagePublicId = car.rcBookImagePublicId || '';
  carPayload.pucCertificateImagePublicId = car.pucCertificateImagePublicId || '';

  Object.assign(car, carPayload);
  await replaceUploadedFile(
    car,
    getUploadedFile(req, 'image'),
    'image',
    'imagePublicId'
  );
  await replaceUploadedFile(
    car,
    getUploadedFile(req, 'ownerLicenseImage'),
    'ownerLicenseImage',
    'ownerLicenseImagePublicId'
  );
  await replaceUploadedFile(
    car,
    getUploadedFile(req, 'ownerLicenseFrontImage'),
    'ownerLicenseFrontImage',
    'ownerLicenseFrontImagePublicId'
  );
  await replaceUploadedFile(
    car,
    getUploadedFile(req, 'ownerLicenseBackImage'),
    'ownerLicenseBackImage',
    'ownerLicenseBackImagePublicId'
  );
  await replaceUploadedFile(
    car,
    getUploadedFile(req, 'rcBookImage'),
    'rcBookImage',
    'rcBookImagePublicId'
  );
  await replaceUploadedFile(
    car,
    getUploadedFile(req, 'pucCertificateImage'),
    'pucCertificateImage',
    'pucCertificateImagePublicId'
  );
  await car.save();

  res.json({
    success: true,
    message: 'Car updated successfully.',
    data: normalizeCarImage(car),
  });
});

const updateOwnerCar = asyncHandler(async (req, res) => {
  const carId = String(req.params.id || '').trim();
  const car = await Car.findOne({ id: carId, ownerId: req.user.id });
  if (!car) {
    throw new HttpError(404, 'Car not found.');
  }

  let carPayload = normalizeCarPayload(req.body);
  carPayload = applyOwnerDefaults(carPayload, req.user);
  carPayload.status = car.status;
  if (!Object.prototype.hasOwnProperty.call(req.body, 'ownerLicenseImage')) {
    carPayload.ownerLicenseImage = car.ownerLicenseImage || '';
  }
  if (!Object.prototype.hasOwnProperty.call(req.body, 'ownerLicenseFrontImage')) {
    carPayload.ownerLicenseFrontImage = car.ownerLicenseFrontImage || '';
  }
  if (!Object.prototype.hasOwnProperty.call(req.body, 'ownerLicenseBackImage')) {
    carPayload.ownerLicenseBackImage = car.ownerLicenseBackImage || '';
  }
  if (!Object.prototype.hasOwnProperty.call(req.body, 'rcBookImage')) {
    carPayload.rcBookImage = car.rcBookImage || '';
  }
  if (!Object.prototype.hasOwnProperty.call(req.body, 'pucCertificateImage')) {
    carPayload.pucCertificateImage = car.pucCertificateImage || '';
  }
  validateCarPayload(carPayload);
  validateCarDocuments(carPayload, req, false);
  await ensureUniqueCarNumber(carPayload.carNumber, carId);
  carPayload.imagePublicId = car.imagePublicId || '';
  carPayload.ownerLicenseImagePublicId = car.ownerLicenseImagePublicId || '';
  carPayload.ownerLicenseFrontImagePublicId = car.ownerLicenseFrontImagePublicId || '';
  carPayload.ownerLicenseBackImagePublicId = car.ownerLicenseBackImagePublicId || '';
  carPayload.rcBookImagePublicId = car.rcBookImagePublicId || '';
  carPayload.pucCertificateImagePublicId = car.pucCertificateImagePublicId || '';

  Object.assign(car, carPayload);
  await replaceUploadedFile(
    car,
    getUploadedFile(req, 'image'),
    'image',
    'imagePublicId'
  );
  await replaceUploadedFile(
    car,
    getUploadedFile(req, 'ownerLicenseImage'),
    'ownerLicenseImage',
    'ownerLicenseImagePublicId'
  );
  await replaceUploadedFile(
    car,
    getUploadedFile(req, 'ownerLicenseFrontImage'),
    'ownerLicenseFrontImage',
    'ownerLicenseFrontImagePublicId'
  );
  await replaceUploadedFile(
    car,
    getUploadedFile(req, 'ownerLicenseBackImage'),
    'ownerLicenseBackImage',
    'ownerLicenseBackImagePublicId'
  );
  await replaceUploadedFile(
    car,
    getUploadedFile(req, 'rcBookImage'),
    'rcBookImage',
    'rcBookImagePublicId'
  );
  await replaceUploadedFile(
    car,
    getUploadedFile(req, 'pucCertificateImage'),
    'pucCertificateImage',
    'pucCertificateImagePublicId'
  );
  await car.save();

  res.json({
    success: true,
    message: 'Car updated successfully.',
    data: normalizeCarImage(car),
  });
});

const approveCar = asyncHandler(async (req, res) => {
  const carId = String(req.params.id || '').trim();
  const car = await Car.findOne({ id: carId });
  if (!car) {
    throw new HttpError(404, 'Car not found.');
  }

  car.status = CAR_STATUS.APPROVED;
  await car.save();

  res.json({
    success: true,
    message: 'Car approved successfully.',
    data: normalizeCarImage(car),
  });
});

const rejectCar = asyncHandler(async (req, res) => {
  const carId = String(req.params.id || '').trim();
  const car = await Car.findOne({ id: carId });
  if (!car) {
    throw new HttpError(404, 'Car not found.');
  }

  car.status = CAR_STATUS.REJECTED;
  await car.save();

  res.json({
    success: true,
    message: 'Car rejected.',
    data: normalizeCarImage(car),
  });
});

const blockCar = asyncHandler(async (req, res) => {
  const carId = String(req.params.id || '').trim();
  const car = await Car.findOne({ id: carId });
  if (!car) {
    throw new HttpError(404, 'Car not found.');
  }

  car.status = CAR_STATUS.BLOCKED;
  await car.save();

  res.json({
    success: true,
    message: 'Car blocked.',
    data: normalizeCarImage(car),
  });
});

const unblockCar = asyncHandler(async (req, res) => {
  const carId = String(req.params.id || '').trim();
  const car = await Car.findOne({ id: carId });
  if (!car) {
    throw new HttpError(404, 'Car not found.');
  }

  car.status = CAR_STATUS.APPROVED;
  await car.save();

  res.json({
    success: true,
    message: 'Car unblocked.',
    data: normalizeCarImage(car),
  });
});

const deleteCar = asyncHandler(async (req, res) => {
  const carId = String(req.params.id || '').trim();
  const car = await Car.findOne({ id: carId });
  if (!car) {
    throw new HttpError(404, 'Car not found.');
  }

  const hasAnyBooking = await Booking.exists({ carId: car.id });
  if (hasAnyBooking) {
    throw new HttpError(
      400,
      'This car has booking history and cannot be deleted.'
    );
  }

  await deleteImages([
    car.imagePublicId,
    car.ownerLicenseImagePublicId,
    car.ownerLicenseFrontImagePublicId,
    car.ownerLicenseBackImagePublicId,
    car.rcBookImagePublicId,
    car.pucCertificateImagePublicId,
  ]);

  await car.deleteOne();

  res.json({
    success: true,
    message: 'Car deleted successfully.',
  });
});

const deleteOwnerCar = asyncHandler(async (req, res) => {
  const carId = String(req.params.id || '').trim();
  const car = await Car.findOne({ id: carId, ownerId: req.user.id });
  if (!car) {
    throw new HttpError(404, 'Car not found.');
  }

  const hasAnyBooking = await Booking.exists({ carId: car.id });
  if (hasAnyBooking) {
    throw new HttpError(
      400,
      'This car has booking history and cannot be deleted.'
    );
  }

  await deleteImages([
    car.imagePublicId,
    car.ownerLicenseImagePublicId,
    car.ownerLicenseFrontImagePublicId,
    car.ownerLicenseBackImagePublicId,
    car.rcBookImagePublicId,
    car.pucCertificateImagePublicId,
  ]);

  await car.deleteOne();

  res.json({
    success: true,
    message: 'Car deleted successfully.',
  });
});

const getOwnerCarById = asyncHandler(async (req, res) => {
  const carId = String(req.params.id || '').trim();
  const car = await Car.findOne({ id: carId, ownerId: req.user.id });
  if (!car) {
    throw new HttpError(404, 'Car not found.');
  }
  res.json({ success: true, data: normalizeCarImage(car) });
});

module.exports = {
  listCars,
  listAdminCars,
  getCarById,
  createCar,
  updateCar,
  approveCar,
  rejectCar,
  blockCar,
  unblockCar,
  deleteCar,
  listOwnerCars,
  getOwnerCarById,
  createOwnerCar,
  updateOwnerCar,
  deleteOwnerCar,
};



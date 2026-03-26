const User = require('../models/user.model');
const asyncHandler = require('../utils/async-handler');
const HttpError = require('../utils/http-error');
const { deleteImage } = require('../services/cloudinary-delete.service');

const LICENSE_REGEX = /^[A-Z]{2}[ -]?[0-9]{2}[ -]?[0-9]{4}[ -]?[0-9]{7}$/;
const AADHAAR_REGEX = /^[2-9][0-9]{11}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^[0-9]{10}$/;

function normalizeProfilePayload(payload) {
  return {
    name: String(payload.name || '').trim(),
    email: String(payload.email || '').trim().toLowerCase(),
    phone: String(payload.phone || '').trim(),
    licenseNumber: String(payload.licenseNumber || '').trim().toUpperCase(),
    licenseImage: String(payload.licenseImage || '').trim(),
    licenseFrontImage: String(payload.licenseFrontImage || '').trim(),
    licenseBackImage: String(payload.licenseBackImage || '').trim(),
    aadhaarNumber: String(payload.aadhaarNumber || '').trim(),
    address: String(payload.address || '').trim(),
    gender: String(payload.gender || '').trim(),
    age: payload.age === '' || payload.age === null || payload.age === undefined
      ? null
      : Number(payload.age),
  };
}

function getUploadedFile(req, field) {
  const files = req.files || {};
  const entry = files[field];
  if (Array.isArray(entry) && entry.length > 0) {
    return entry[0];
  }
  return null;
}

function validateProfilePayload(payload, req, existingUser = null) {
  if (payload.name && payload.name.length < 2) {
    throw new HttpError(400, 'Name must be at least 2 characters.');
  }

  if (payload.email && !EMAIL_REGEX.test(payload.email)) {
    throw new HttpError(400, 'Invalid email format.');
  }

  if (payload.phone && !PHONE_REGEX.test(payload.phone)) {
    throw new HttpError(400, 'Phone number must be 10 digits.');
  }

  if (payload.licenseNumber && !LICENSE_REGEX.test(payload.licenseNumber)) {
    throw new HttpError(400, 'Invalid license number format.');
  }

  const frontFile =
    getUploadedFile(req, 'licenseFrontImage') || getUploadedFile(req, 'licenseImage');
  const backFile = getUploadedFile(req, 'licenseBackImage');
  const existingFront =
    existingUser?.licenseFrontImage || existingUser?.licenseImage || '';
  const existingBack = existingUser?.licenseBackImage || '';
  const hasFront = Boolean(frontFile || existingFront);
  const hasBack = Boolean(backFile || existingBack);

  if (payload.licenseNumber && (!hasFront || !hasBack)) {
    throw new HttpError(400, 'License front and back images are required with the license number.');
  }

  const frontImage = payload.licenseFrontImage || payload.licenseImage || '';
  if (frontImage) {
    throw new HttpError(400, 'Please upload license images as files.');
  }
  if (payload.licenseBackImage) {
    throw new HttpError(400, 'Please upload license images as files.');
  }

  if (payload.aadhaarNumber && !AADHAAR_REGEX.test(payload.aadhaarNumber)) {
    throw new HttpError(400, 'Aadhaar number must be 12 digits and start with 2-9.');
  }

  if (payload.gender && !['Male', 'Female'].includes(payload.gender)) {
    throw new HttpError(400, 'Gender must be Male or Female.');
  }

  if (payload.age !== null) {
    if (!Number.isFinite(payload.age)) {
      throw new HttpError(400, 'Age must be a number.');
    }
    if (payload.age < 18 || payload.age > 84) {
      throw new HttpError(400, 'Age must be between 18 and 84.');
    }
  }
}

const getOwnerProfile = asyncHandler(async (req, res) => {
  const user = await User.findOne({ id: req.user.id });
  if (!user) {
    throw new HttpError(404, 'User not found.');
  }

  res.json({
    success: true,
    data: {
      ...user.toSafeObject(),
      licenseFrontImage: user.licenseFrontImage || user.licenseImage || '',
      licenseBackImage: user.licenseBackImage || '',
    },
  });
});

const updateOwnerProfile = asyncHandler(async (req, res) => {
  const user = await User.findOne({ id: req.user.id });
  if (!user) {
    throw new HttpError(404, 'User not found.');
  }

  const payload = normalizeProfilePayload(req.body);
  validateProfilePayload(payload, req, user);

  if (payload.email && payload.email !== user.email) {
    const existing = await User.findOne({ email: payload.email });
    if (existing) {
      throw new HttpError(409, 'Email already registered.');
    }
    user.email = payload.email;
  }

  if (payload.name) {
    user.name = payload.name;
  }
  if (payload.phone) {
    user.phone = payload.phone;
  }

  const frontFile =
    getUploadedFile(req, 'licenseFrontImage') || getUploadedFile(req, 'licenseImage');
  const backFile = getUploadedFile(req, 'licenseBackImage');

  if (frontFile) {
    if (user.licenseFrontImagePublicId) {
      await deleteImage(user.licenseFrontImagePublicId);
    }
    if (user.licenseImagePublicId && user.licenseImagePublicId !== user.licenseFrontImagePublicId) {
      await deleteImage(user.licenseImagePublicId);
    }
    user.licenseFrontImage = frontFile.path || '';
    user.licenseFrontImagePublicId = frontFile.filename || '';
    user.licenseImage = user.licenseFrontImage;
    user.licenseImagePublicId = user.licenseFrontImagePublicId;
  }

  if (backFile) {
    if (user.licenseBackImagePublicId) {
      await deleteImage(user.licenseBackImagePublicId);
    }
    user.licenseBackImage = backFile.path || '';
    user.licenseBackImagePublicId = backFile.filename || '';
  }

  user.licenseNumber = payload.licenseNumber || '';
  user.aadhaarNumber = payload.aadhaarNumber || '';
  user.address = payload.address || '';
  user.gender = payload.gender || '';
  user.age = payload.age;

  await user.save();

  res.json({
    success: true,
    message: 'Profile updated successfully.',
    data: {
      ...user.toSafeObject(),
      licenseFrontImage: user.licenseFrontImage || user.licenseImage || '',
      licenseBackImage: user.licenseBackImage || '',
    },
  });
});

module.exports = {
  getOwnerProfile,
  updateOwnerProfile,
};

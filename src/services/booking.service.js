const Booking = require('../models/booking.model');
const Car = require('../models/car.model');
const User = require('../models/user.model');
const { BookingHold, HOLD_TTL_SECONDS } = require('../models/booking-hold.model');
const HttpError = require('../utils/http-error');
const { BOOKING_STATUS, CAR_STATUS } = require('../constants/enums');
const { normalizeImageUrl } = require('../utils/normalize-image-url');
const crypto = require('crypto');

const PLATFORM_FEE_RATE = 0.05;
const OWNER_PLATFORM_FEE_RATE = 0.15;
const GST_RATE = 0.18;
const HOLD_TTL_MS = HOLD_TTL_SECONDS * 1000;

function isValidPhone(phone) {
  return /^[0-9]{10}$/.test(phone);
}

function isValidAadhaar(aadhaar) {
  return /^[2-9][0-9]{11}$/.test(aadhaar);
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidPincode(pincode) {
  return /^[1-9][0-9]{5}$/.test(pincode);
}

function isValidLicense(licenseNumber) {
  return /^[A-Z]{2}[ -]?[0-9]{2}[ -]?[0-9]{4}[ -]?[0-9]{7}$/.test(
    licenseNumber.toUpperCase()
  );
}

function isValidName(name) {
  return String(name || '').trim().length >= 2;
}

function isAdult(dob) {
  if (!dob) {
    return false;
  }
  const dobDate = new Date(dob);
  if (Number.isNaN(dobDate.getTime())) {
    return false;
  }
  const today = new Date();
  let age = today.getFullYear() - dobDate.getFullYear();
  const monthDiff = today.getMonth() - dobDate.getMonth();
  const dayDiff = today.getDate() - dobDate.getDate();
  if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
    age -= 1;
  }
  return age >= 18;
}

function isValidFileData(value) {
  if (typeof value !== 'string') {
    return false;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return false;
  }
  if (/^https?:\/\//.test(trimmed)) {
    return true;
  }
  return /^data:(image\/[a-zA-Z0-9.+-]+|application\/pdf);base64,/.test(trimmed);
}

function normalizeBoolean(value) {
  return value === true || value === 'true';
}

function getTotalDays(pickupDate, returnDate) {
  const start = new Date(pickupDate);
  const end = new Date(returnDate);
  const diff = end.getTime() - start.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function round2(value) {
  return Number(Number(value).toFixed(2));
}

function generatePickupCode(length = 6) {
  const max = 10 ** length;
  const value = crypto.randomInt(0, max);
  return String(value).padStart(length, '0');
}

function calculatePricing(pricePerDay, pickupDate, returnDate) {
  const totalDays = getTotalDays(pickupDate, returnDate);
  if (totalDays <= 0) {
    throw new HttpError(400, 'Return date must be after pickup date.');
  }

  const baseAmount = round2(totalDays * Number(pricePerDay || 0));
  const platformFee = round2(baseAmount * PLATFORM_FEE_RATE);
  const gstAmount = round2(platformFee * GST_RATE);
  const totalAmount = round2(baseAmount + platformFee + gstAmount);

  return {
    totalDays,
    baseAmount,
    platformFee,
    gstAmount,
    totalAmount,
  };
}

function calculateOwnerEarnings(baseAmount) {
  const commission = round2(baseAmount * OWNER_PLATFORM_FEE_RATE);
  const gstOnCommission = round2(commission * GST_RATE);
  const ownerEarnings = round2(baseAmount - commission - gstOnCommission);
  return {
    ownerEarnings,
    commission,
    gstOnCommission,
  };
}

function normalizeBookingPayload(payload) {
  return {
    carId: String(payload.carId || '').trim(),
    pickupDate: String(payload.pickupDate || '').trim(),
    returnDate: String(payload.returnDate || '').trim(),
    fullName: String(payload.fullName || '').trim(),
    phone: String(payload.phone || '').trim(),
    alternatePhone: String(payload.alternatePhone || '').trim(),
    email: String(payload.email || '').trim().toLowerCase(),
    dob: String(payload.dob || '').trim(),
    address: String(payload.address || '').trim(),
    city: String(payload.city || '').trim(),
    state: String(payload.state || '').trim(),
    pincode: String(payload.pincode || '').trim(),
    aadhaar: String(payload.aadhaar || '').trim(),
    licenseNumber: String(payload.licenseNumber || '').trim().toUpperCase(),
    licenseFront: String(payload.licenseFront || '').trim(),
    licenseBack: String(payload.licenseBack || '').trim(),
    emergencyName: String(payload.emergencyName || '').trim(),
    emergencyPhone: String(payload.emergencyPhone || '').trim(),
    agreeTerms: normalizeBoolean(payload.agreeTerms),
    agreeLicense: normalizeBoolean(payload.agreeLicense),
  };
}

function validateBookingPayload(payload, options = {}) {
  const {
    pickupDate,
    returnDate,
    fullName,
    phone,
    alternatePhone,
    email,
    dob,
    address,
    city,
    state,
    pincode,
    aadhaar,
    licenseNumber,
    licenseFront,
    licenseBack,
    emergencyName,
    emergencyPhone,
    agreeTerms,
    agreeLicense,
  } = payload;
  const licenseFrontFile = options.licenseFrontFile || null;
  const licenseBackFile = options.licenseBackFile || null;

  if (!pickupDate || !returnDate) {
    throw new HttpError(400, 'Please select pickup and return dates.');
  }

  if (!fullName || !phone || !email) {
    throw new HttpError(400, 'Please enter full name, phone number, and email.');
  }

  if (!isValidPhone(phone)) {
    throw new HttpError(400, 'Phone number must be 10 digits.');
  }

  if (alternatePhone && !isValidPhone(alternatePhone)) {
    throw new HttpError(400, 'Alternate phone number must be 10 digits.');
  }

  if (!isValidEmail(email)) {
    throw new HttpError(400, 'Please enter a valid email address.');
  }

  if (!isAdult(dob)) {
    throw new HttpError(400, 'You must be at least 18 years old to book.');
  }

  if (!address || !city || !state) {
    throw new HttpError(400, 'Please enter your address, city, and state.');
  }

  if (!isValidPincode(pincode)) {
    throw new HttpError(400, 'Pincode must be 6 digits and cannot start with 0.');
  }

  if (!isValidAadhaar(aadhaar)) {
    throw new HttpError(400, 'Aadhaar number must be 12 digits and start with 2-9.');
  }

  if (!isValidLicense(licenseNumber)) {
    throw new HttpError(400, 'Please enter a valid driving license number.');
  }

  if (licenseFront || licenseBack) {
    throw new HttpError(400, 'Please upload license images as files.');
  }

  if (!licenseFrontFile || !licenseBackFile) {
    throw new HttpError(400, 'Please upload both driving license images.');
  }

  if (!emergencyName || !emergencyPhone) {
    throw new HttpError(400, 'Please enter emergency contact name and phone.');
  }

  if (!isValidName(emergencyName)) {
    throw new HttpError(400, 'Emergency contact name must be at least 2 characters.');
  }

  if (!isValidPhone(emergencyPhone)) {
    throw new HttpError(400, 'Emergency contact phone must be 10 digits.');
  }

  if (emergencyName.toLowerCase() === fullName.toLowerCase()) {
    throw new HttpError(400, 'Emergency contact name must be different from your name.');
  }

  if (emergencyPhone === phone) {
    throw new HttpError(400, 'Emergency contact phone must be different from your phone.');
  }

  if (!agreeTerms || !agreeLicense) {
    throw new HttpError(400, 'Please accept the terms and confirm license validity.');
  }
}

async function ensureCarBookable(carId) {
  const car = await Car.findOne({ id: carId });
  if (!car) {
    throw new HttpError(404, 'Car not found.');
  }
  if (car.status !== CAR_STATUS.APPROVED) {
    throw new HttpError(400, 'This car is not available for booking.');
  }

  if (car.ownerId) {
    const owner = await User.findOne({ id: car.ownerId });
    if (owner?.blocked) {
      throw new HttpError(404, 'Car not found.');
    }
  }

  return car;
}

function isRangeOverlap(startA, endA, startB, endB) {
  return startA <= endB && endA >= startB;
}

async function hasDateConflict(carId, pickupDate, returnDate, options = {}) {
  const relevantBookings = await Booking.find({
    carId,
    status: {
      $in: [
        BOOKING_STATUS.CONFIRMED,
        BOOKING_STATUS.PICKUP_DUE,
        BOOKING_STATUS.ACTIVE,
        BOOKING_STATUS.AWAITING_RETURN,
      ],
    },
  });

  const now = Date.now();
  const activeHolds = await BookingHold.find({ carId });

  const newStart = new Date(pickupDate);
  const newEnd = new Date(returnDate);

  const bookingConflict = relevantBookings.some((booking) => {
    const existingStart = new Date(booking.pickupDate);
    const existingEnd = new Date(booking.returnDate);
    return isRangeOverlap(newStart, newEnd, existingStart, existingEnd);
  });

  if (bookingConflict) {
    return true;
  }

  const holdConflict = activeHolds.some((hold) => {
    if (options.excludeHoldOrderId && hold.orderId === options.excludeHoldOrderId) {
      return false;
    }
    const createdAt = hold.createdAt ? hold.createdAt.getTime() : 0;
    if (!createdAt || now - createdAt > HOLD_TTL_MS) {
      return false;
    }
    const existingStart = new Date(hold.pickupDate);
    const existingEnd = new Date(hold.returnDate);
    return isRangeOverlap(newStart, newEnd, existingStart, existingEnd);
  });

  return holdConflict;
}

function stripSensitiveFields(booking) {
  const data = booking?.toObject ? booking.toObject() : { ...booking };
  delete data.pickupCode;
  delete data.licenseFront;
  delete data.licenseFrontPublicId;
  delete data.licenseBack;
  delete data.licenseBackPublicId;
  delete data.documentsId;
  delete data.licenseNumber;
  delete data.aadhaar;
  delete data.address;
  delete data.city;
  delete data.state;
  delete data.pincode;
  delete data.dob;
  delete data.emergencyName;
  delete data.emergencyPhone;
  delete data.email;
  if (data.image) {
    data.image = normalizeImageUrl(data.image);
  }
  return data;
}

module.exports = {
  calculatePricing,
  normalizeBookingPayload,
  validateBookingPayload,
  ensureCarBookable,
  hasDateConflict,
  stripSensitiveFields,
  PLATFORM_FEE_RATE,
  OWNER_PLATFORM_FEE_RATE,
  GST_RATE,
  calculateOwnerEarnings,
  generatePickupCode,
};

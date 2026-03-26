const Booking = require('../models/booking.model');
const Car = require('../models/car.model');
const User = require('../models/user.model');
const asyncHandler = require('../utils/async-handler');
const HttpError = require('../utils/http-error');
const { BOOKING_STATUS, CAR_STATUS, USER_ROLES } = require('../constants/enums');
const { calculateOwnerEarnings, generatePickupCode } = require('../services/booking.service');
const OwnerPayout = require('../models/owner-payout.model');
const { normalizeImageUrl } = require('../utils/normalize-image-url');
const { buildInvoicePdf } = require('../services/invoice.service');
const { sendOwnerPayoutEmail } = require('../services/booking-email.service');

const MAX_BOOKING_DOC_BYTES = 2 * 1024 * 1024;

function getUploadedFile(req, field) {
  const files = req.files || {};
  const entry = files[field];
  if (Array.isArray(entry) && entry.length > 0) {
    return entry[0];
  }
  return null;
}

function validateBookingFile(file, label) {
  if (!file) {
    return;
  }
  const isImage = file.mimetype && file.mimetype.startsWith('image/');
  const isPdf = file.mimetype === 'application/pdf';
  if (!isImage && !isPdf) {
    throw new HttpError(400, `${label} must be an image or PDF file.`);
  }
  if (file.size > MAX_BOOKING_DOC_BYTES) {
    throw new HttpError(400, `${label} must be 2MB or smaller.`);
  }
}

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

async function hasDateConflict(carId, pickupDate, returnDate) {
  const relevant = await Booking.find({
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

  const newStart = new Date(pickupDate);
  const newEnd = new Date(returnDate);

  return relevant.some((booking) => {
    const existingStart = new Date(booking.pickupDate);
    const existingEnd = new Date(booking.returnDate);
    return newStart <= existingEnd && newEnd >= existingStart;
  });
}

function stripSensitiveFields(booking) {
  const data = booking?.toObject ? booking.toObject() : { ...booking };
  delete data.pickupCode;
  delete data.licenseFront;
  delete data.licenseFrontPublicId;
  delete data.licenseBack;
  delete data.licenseBackPublicId;
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

function normalizeBooking(booking, carNumberLookup, includeSensitive = false) {
  const base = includeSensitive ? booking.toObject() : stripSensitiveFields(booking);
  delete base.pickupCode;
  if (base.image) {
    base.image = normalizeImageUrl(base.image);
  }
  if (includeSensitive) {
    if (base.licenseFront) {
      base.licenseFront = normalizeImageUrl(base.licenseFront);
    }
    if (base.licenseBack) {
      base.licenseBack = normalizeImageUrl(base.licenseBack);
    }
    delete base.licenseFrontPublicId;
    delete base.licenseBackPublicId;
  }
  return {
    ...base,
    bookingId: booking.bookingId || `BK-${booking.id || Date.now()}`,
    carNumber: booking.carNumber || carNumberLookup.get(booking.carId) || 'N/A',
    fullName: booking.fullName || 'N/A',
    phone: booking.phone || 'N/A',
    userEmail: booking.userEmail || 'N/A',
  };
}

const createBooking = asyncHandler(async (req, res) => {
  const carId = String(req.body.carId || '').trim();
  const pickupDate = String(req.body.pickupDate || '').trim();
  const returnDate = String(req.body.returnDate || '').trim();
  const fullName = String(req.body.fullName || '').trim();
  const phone = String(req.body.phone || '').trim();
  const alternatePhone = String(req.body.alternatePhone || '').trim();
  const email = String(req.body.email || '').trim().toLowerCase();
  const dob = String(req.body.dob || '').trim();
  const address = String(req.body.address || '').trim();
  const city = String(req.body.city || '').trim();
  const state = String(req.body.state || '').trim();
  const pincode = String(req.body.pincode || '').trim();
  const aadhaar = String(req.body.aadhaar || '').trim();
  const licenseNumber = String(req.body.licenseNumber || '').trim().toUpperCase();
  let licenseFront = String(req.body.licenseFront || '').trim();
  let licenseBack = String(req.body.licenseBack || '').trim();
  const emergencyName = String(req.body.emergencyName || '').trim();
  const emergencyPhone = String(req.body.emergencyPhone || '').trim();
  const agreeTerms = normalizeBoolean(req.body.agreeTerms);
  const agreeLicense = normalizeBoolean(req.body.agreeLicense);

  const car = await Car.findOne({ id: carId });
  if (!car) {
    throw new HttpError(404, 'Car not found.');
  }
  if (car.status !== CAR_STATUS.APPROVED) {
    throw new HttpError(400, 'This car is not available for booking.');
  }

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

  if (!licenseFront || !licenseBack) {
    throw new HttpError(400, 'Please upload both driving license images.');
  }

  if (!isValidFileData(licenseFront) || !isValidFileData(licenseBack)) {
    throw new HttpError(400, 'Driving license files must be images or PDFs.');
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

  const totalDays = getTotalDays(pickupDate, returnDate);
  if (totalDays <= 0) {
    throw new HttpError(400, 'Return date must be after pickup date.');
  }

  const conflict = await hasDateConflict(carId, pickupDate, returnDate);
  if (conflict) {
    throw new HttpError(400, 'Selected dates are unavailable.');
  }

  const baseAmount = totalDays * Number(car.pricePerDay || 0);
  const platformFee = baseAmount * 0.05;
  const gstAmount = platformFee * 0.18;
  const totalAmount = baseAmount + platformFee + gstAmount;
  const ownerEarnings = calculateOwnerEarnings(baseAmount).ownerEarnings;

  const booking = new Booking({
    carId: car.id,
    carNumber: car.carNumber || '',
    carName: car.name,
    image: car.image || '',
    ownerId: car.ownerId || '',
    ownerEmail: car.ownerEmail || '',
    pickupDate,
    returnDate,
    totalDays,
    totalPrice: baseAmount,
    totalAmount,
    platformFee,
    gstAmount,
    ownerEarnings,
    ownerPayoutPaid: false,
    status: BOOKING_STATUS.CONFIRMED,
    pickupCode: generatePickupCode(),
    rating: 0,
    userId: req.user.id,
    userEmail: req.user.email,
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
  });

  await booking.save();

  res.status(201).json({
    success: true,
    message: `Booking confirmed! ID: ${booking.bookingId}`,
    data: stripSensitiveFields(booking),
  });
});

const getMyBookings = asyncHandler(async (req, res) => {
  const bookings = await Booking.find({
    $or: [{ userId: req.user.id }, { userEmail: req.user.email }],
  }).sort({ createdAt: -1 });

  res.json({
    success: true,
    data: bookings.map((booking) => stripSensitiveFields(booking)),
  });
});

const rateMyBooking = asyncHandler(async (req, res) => {
  const bookingId = Number(req.params.id);
  const rating = Number(req.body.rating);
  const review = String(req.body.review || '').trim();

  if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
    throw new HttpError(400, 'Rating must be between 1 and 5.');
  }
  if (review.length > 100) {
    throw new HttpError(400, 'Review must be 100 characters or fewer.');
  }

  const booking = await Booking.findOne({ id: bookingId });
  if (!booking) {
    throw new HttpError(404, 'Booking not found.');
  }

  const isOwner =
    booking.userId === req.user.id || booking.userEmail === req.user.email;
  if (!isOwner) {
    throw new HttpError(403, 'Forbidden');
  }

  booking.rating = rating;
  booking.review = review;
  await booking.save();

  res.json({
    success: true,
    message: 'Thanks for your rating.',
    data: stripSensitiveFields(booking),
  });
});

const getBookedRangesForCar = asyncHandler(async (req, res) => {
  const carId = String(req.params.carId || '').trim();
  const bookings = await Booking.find({
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

  const ranges = bookings.map((booking) => ({
    start: booking.pickupDate,
    end: booking.returnDate,
  }));

  res.json({
    success: true,
    data: ranges,
  });
});

const listAdminBookings = asyncHandler(async (req, res) => {
  const rawBookings = await Booking.find().sort({ id: -1 });
  const cars = await Car.find();
  const carNumberLookup = new Map(
    cars.map((car) => [car.id, car.carNumber || 'N/A'])
  );

  const bookings = rawBookings.map((booking) =>
    normalizeBooking(booking, carNumberLookup, false)
  );

  res.json({
    success: true,
    data: bookings,
  });
});

const listOwnerBookings = asyncHandler(async (req, res) => {
  const ownerCars = await Car.find({ ownerId: req.user.id }, { id: 1, carNumber: 1 });
  const carIds = ownerCars.map((car) => car.id);
  const carNumberLookup = new Map(
    ownerCars.map((car) => [car.id, car.carNumber || 'N/A'])
  );

  const bookings = await Booking.find({
    carId: { $in: carIds },
  }).sort({ createdAt: -1 });

  res.json({
    success: true,
    data: bookings.map((booking) => normalizeBooking(booking, carNumberLookup, true)),
  });
});

async function ensureOwnerAccess(booking, req) {
  if (!booking) {
    throw new HttpError(404, 'Booking not found.');
  }

  const ownerId = String(req.user.id || '');
  const ownerEmail = String(req.user.email || '').toLowerCase();
  const matchesId = booking.ownerId && booking.ownerId === ownerId;
  const matchesEmail =
    booking.ownerEmail && booking.ownerEmail.toLowerCase() === ownerEmail;

  if (matchesId || matchesEmail) {
    return;
  }

  const car = await Car.findOne({ id: booking.carId }, { ownerId: 1, ownerEmail: 1 });
  const carOwnerId = car?.ownerId || '';
  const carOwnerEmail = String(car?.ownerEmail || '').toLowerCase();
  if (carOwnerId === ownerId || (carOwnerEmail && carOwnerEmail === ownerEmail)) {
    return;
  }

  throw new HttpError(403, 'Forbidden');
}

const approveOwnerBooking = asyncHandler(async (req, res) => {
  const bookingId = Number(req.params.id);
  const booking = await Booking.findOne({ id: bookingId });
  await ensureOwnerAccess(booking, req);

  throw new HttpError(400, 'Owner approval is no longer required.');
});

const rejectOwnerBooking = asyncHandler(async (req, res) => {
  const bookingId = Number(req.params.id);
  const booking = await Booking.findOne({ id: bookingId });
  await ensureOwnerAccess(booking, req);

  throw new HttpError(400, 'Owner rejection is no longer required.');
});

const completeOwnerBooking = asyncHandler(async (req, res) => {
  const bookingId = Number(req.params.id);
  const booking = await Booking.findOne({ id: bookingId });
  await ensureOwnerAccess(booking, req);

  if (booking.status !== BOOKING_STATUS.AWAITING_RETURN) {
    throw new HttpError(400, 'Only awaiting return bookings can be completed.');
  }

  booking.status = BOOKING_STATUS.COMPLETED;
  await booking.save();

  res.json({
    success: true,
    message: 'Booking marked as completed.',
    data: stripSensitiveFields(booking),
  });
});

const verifyOwnerPickupCode = asyncHandler(async (req, res) => {
  const bookingId = Number(req.params.id);
  const pickupCode = String(req.body.pickupCode || '').trim();
  if (!pickupCode) {
    throw new HttpError(400, 'Pickup code is required.');
  }

  const booking = await Booking.findOne({ id: bookingId });
  await ensureOwnerAccess(booking, req);

  if (booking.status !== BOOKING_STATUS.PICKUP_DUE) {
    throw new HttpError(400, 'Booking is not ready for pickup verification.');
  }

  if (String(booking.pickupCode || '') !== pickupCode) {
    throw new HttpError(400, 'Invalid pickup code. Please try again.');
  }

  booking.status = BOOKING_STATUS.ACTIVE;
  booking.pickupCodeVerifiedAt = new Date();
  await booking.save();

  res.json({
    success: true,
    message: 'Pickup verified successfully. Booking is now active.',
    data: stripSensitiveFields(booking),
  });
});

const approveBooking = asyncHandler(async (req, res) => {
  const bookingId = Number(req.params.id);
  const booking = await Booking.findOne({ id: bookingId });
  if (!booking) {
    throw new HttpError(404, 'Booking not found.');
  }

  throw new HttpError(400, 'Admin approval is no longer required.');
});

const rejectBooking = asyncHandler(async (req, res) => {
  const bookingId = Number(req.params.id);
  const booking = await Booking.findOne({ id: bookingId });
  if (!booking) {
    throw new HttpError(404, 'Booking not found.');
  }

  throw new HttpError(400, 'Admin rejection is no longer required.');
});

const completeBooking = asyncHandler(async (req, res) => {
  const bookingId = Number(req.params.id);
  const booking = await Booking.findOne({ id: bookingId });
  if (!booking) {
    throw new HttpError(404, 'Booking not found.');
  }

  throw new HttpError(400, 'Admin completion is no longer required.');
});

function getOwnerEarning(booking) {
  const amount = Number(booking.ownerEarnings);
  if (Number.isFinite(amount) && amount > 0) {
    return amount;
  }
  const baseAmount = Number(booking.totalPrice || 0);
  if (!Number.isFinite(baseAmount) || baseAmount <= 0) {
    return 0;
  }
  return calculateOwnerEarnings(baseAmount).ownerEarnings || 0;
}

const markOwnerPayoutsPaid = asyncHandler(async (req, res) => {
  const ownerId = String(req.params.ownerId || req.params.id || '').trim();
  if (!ownerId) {
    throw new HttpError(400, 'Owner ID is required.');
  }

  const unpaidBookings = await Booking.find({
    ownerId,
    status: BOOKING_STATUS.COMPLETED,
    ownerPayoutPaid: { $ne: true },
  });

  if (!unpaidBookings.length) {
    res.json({
      success: true,
      message: 'No unpaid earnings found.',
      data: { modifiedCount: 0 },
    });
    return;
  }

  const bookingIds = unpaidBookings.map((booking) => booking.id);
  const amountPaid = unpaidBookings.reduce(
    (sum, booking) => sum + getOwnerEarning(booking),
    0
  );
  const paidAt = new Date();

  const payout = new OwnerPayout({
    ownerId,
    ownerEmail: unpaidBookings[0]?.ownerEmail || '',
    amountPaid,
    bookingCount: unpaidBookings.length,
    bookingIds,
    paidAt,
  });

  await payout.save();

  const result = await Booking.updateMany(
    { id: { $in: bookingIds } },
    {
      $set: {
        ownerPayoutPaid: true,
        ownerPaidAt: paidAt,
        ownerPayoutBatchId: payout.payoutId,
      },
    }
  );

  try {
    let owner = await User.findOne({ id: ownerId });
    if (!owner && payout.ownerEmail) {
      owner = await User.findOne({ email: payout.ownerEmail });
    }
    const ownerEmail = owner?.email || payout.ownerEmail;
    const ownerName = owner?.name || 'Owner';
    await sendOwnerPayoutEmail({
      ownerEmail,
      ownerName,
      amountPaid: payout.amountPaid,
      bookingCount: payout.bookingCount,
      paidAt: payout.paidAt
        ? new Date(payout.paidAt).toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
          })
        : '',
      payoutId: payout.payoutId,
    });
  } catch (mailError) {
    // eslint-disable-next-line no-console
    console.error('[Mail] Failed to send payout email:', mailError?.message || mailError);
  }

  res.json({
    success: true,
    message:
      result.modifiedCount > 0
        ? `Marked ${result.modifiedCount} booking payouts as paid.`
        : 'No unpaid earnings found.',
    data: {
      modifiedCount: result.modifiedCount,
      payout: {
        payoutId: payout.payoutId,
        amountPaid: payout.amountPaid,
        bookingCount: payout.bookingCount,
        paidAt: payout.paidAt,
      },
    },
  });
});

const downloadInvoice = asyncHandler(async (req, res) => {
  const rawId = String(req.params.id || '').trim();
  const numericId = Number(rawId);

  let booking = null;
  if (Number.isFinite(numericId)) {
    booking = await Booking.findOne({ id: numericId });
  }
  if (!booking && rawId) {
    booking = await Booking.findOne({ bookingId: rawId });
  }

  if (!booking) {
    throw new HttpError(404, 'Booking not found.');
  }

  const isAdmin = req.user?.role === USER_ROLES.ADMIN;
  const isOwner =
    booking.userId === req.user?.id || booking.userEmail === req.user?.email;

  if (!isAdmin && !isOwner) {
    throw new HttpError(403, 'Forbidden');
  }

  const car = await Car.findOne({ id: booking.carId });
  const user = (await User.findOne({ id: booking.userId })) || req.user;

  let owner = null;
  if (booking.ownerId) {
    owner = await User.findOne({ id: booking.ownerId });
  }
  if (!owner && booking.ownerEmail) {
    owner = await User.findOne({ email: booking.ownerEmail });
  }

  const doc = buildInvoicePdf({ booking, car, user, owner });

  const fileId = booking.bookingId || booking.id || 'invoice';
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="Car2Go_Invoice_${fileId}.pdf"`
  );

  doc.pipe(res);
  doc.end();
});

module.exports = {
  createBooking,
  getMyBookings,
  rateMyBooking,
  getBookedRangesForCar,
  listAdminBookings,
  listOwnerBookings,
  approveOwnerBooking,
  rejectOwnerBooking,
  completeOwnerBooking,
  verifyOwnerPickupCode,
  approveBooking,
  rejectBooking,
  completeBooking,
  markOwnerPayoutsPaid,
  downloadInvoice,
};

const Booking = require('../models/booking.model');
const { BookingHold, HOLD_TTL_SECONDS } = require('../models/booking-hold.model');
const User = require('../models/user.model');
const env = require('../config/env');
const HttpError = require('../utils/http-error');
const { BOOKING_STATUS, PAYMENT_STATUS } = require('../constants/enums');
const {
  calculatePricing,
  calculateOwnerEarnings,
  normalizeBookingPayload,
  validateBookingPayload,
  ensureCarBookable,
  hasDateConflict,
  stripSensitiveFields,
  generatePickupCode,
} = require('../services/booking.service');
const { createOrder, verifySignature } = require('../services/razorpay.service');
const {
  sendBookingSuccessEmails,
  sendBookingFailureEmail,
} = require('../services/booking-email.service');
const asyncHandler = require('../utils/async-handler');

const HOLD_TTL_MS = HOLD_TTL_SECONDS * 1000;

function getFailureReason(error) {
  if (!error) {
    return 'Booking failed.';
  }
  if (error instanceof HttpError) {
    if (error.statusCode === 409) {
      return 'Selected dates are no longer available.';
    }
    if (error.statusCode === 410) {
      return 'Payment order expired. Please try again.';
    }
    if (error.statusCode === 403) {
      return 'Payment does not belong to this user.';
    }
    if (error.statusCode === 400 && /signature/i.test(error.message)) {
      return 'Payment verification failed.';
    }
  }
  return error.message || 'Booking failed.';
}

function isHoldActive(hold) {
  if (!hold?.createdAt) {
    return false;
  }
  return Date.now() - hold.createdAt.getTime() <= HOLD_TTL_MS;
}

function getUploadedFile(req, field) {
  const files = req.files || {};
  const entry = files[field];
  if (Array.isArray(entry) && entry.length > 0) {
    return entry[0];
  }
  return null;
}

function toPaise(amount) {
  return Math.max(1, Math.round(Number(amount || 0) * 100));
}

const createPaymentOrder = asyncHandler(async (req, res) => {
  const carId = String(req.body.carId || '').trim();
  const pickupDate = String(req.body.pickupDate || '').trim();
  const returnDate = String(req.body.returnDate || '').trim();

  if (!carId) {
    throw new HttpError(400, 'Car ID is required.');
  }

  if (!pickupDate || !returnDate) {
    throw new HttpError(400, 'Pickup and return dates are required.');
  }

  const car = await ensureCarBookable(carId);

  const pricing = calculatePricing(car.pricePerDay, pickupDate, returnDate);

  const conflict = await hasDateConflict(carId, pickupDate, returnDate);
  if (conflict) {
    throw new HttpError(409, 'Selected dates are unavailable.');
  }

  const existingHold = await BookingHold.findOne({
    userId: req.user.id,
    carId,
    pickupDate,
    returnDate,
  });

  if (existingHold) {
    if (isHoldActive(existingHold)) {
      res.json({
        success: true,
        data: {
          orderId: existingHold.orderId,
          amount: toPaise(existingHold.totalAmount),
          currency: existingHold.currency || 'INR',
          keyId: env.razorpayKeyId,
          totalDays: existingHold.totalDays,
          baseAmount: Number((existingHold.totalAmount - existingHold.platformFee - existingHold.gstAmount).toFixed(2)),
          platformFee: existingHold.platformFee,
          gstAmount: existingHold.gstAmount,
          totalAmount: existingHold.totalAmount,
          holdSeconds: HOLD_TTL_SECONDS,
        },
      });
      return;
    }

    await existingHold.deleteOne();
  }

  const order = await createOrder({
    amount: toPaise(pricing.totalAmount),
    currency: 'INR',
    receipt: `car-${carId}-${Date.now()}`,
    notes: {
      carId,
      userId: req.user.id,
      pickupDate,
      returnDate,
    },
  });

  const hold = new BookingHold({
    orderId: order.id,
    userId: req.user.id,
    carId,
    pickupDate,
    returnDate,
    totalDays: pricing.totalDays,
    totalAmount: pricing.totalAmount,
    platformFee: pricing.platformFee,
    gstAmount: pricing.gstAmount,
    currency: order.currency || 'INR',
  });

  await hold.save();

  res.json({
    success: true,
    data: {
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: env.razorpayKeyId,
      totalDays: pricing.totalDays,
      baseAmount: pricing.baseAmount,
      platformFee: pricing.platformFee,
      gstAmount: pricing.gstAmount,
      totalAmount: pricing.totalAmount,
      holdSeconds: HOLD_TTL_SECONDS,
    },
  });
});

const reportPaymentFailure = asyncHandler(async (req, res) => {
  const orderId = String(req.body.razorpay_order_id || '').trim();
  const reason = String(req.body.reason || 'Payment cancelled by user.').trim();

  if (orderId) {
    const hold = await BookingHold.findOne({ orderId });
    if (hold) {
      if (hold.userId !== req.user.id) {
        throw new HttpError(403, 'Payment does not belong to this user.');
      }
      await hold.deleteOne();
    }
  }

  try {
    const userEmail = req.user?.email || req.body?.email;
    const userName = req.body?.fullName || req.user?.name || 'Customer';
    await sendBookingFailureEmail({
      email: userEmail,
      name: userName,
      reason,
    });
  } catch (mailError) {
    console.error('[Mail] Failed to send booking failure email:', mailError?.message || mailError);
  }

  res.json({
    success: true,
    message: 'Payment failure recorded.',
  });
});

const verifyPaymentAndCreateBooking = asyncHandler(async (req, res) => {
  try {
    const razorpayOrderId = String(req.body.razorpay_order_id || '').trim();
    const razorpayPaymentId = String(req.body.razorpay_payment_id || '').trim();
    const razorpaySignature = String(req.body.razorpay_signature || '').trim();

    if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      throw new HttpError(400, 'Payment verification data is required.');
    }

    const hold = await BookingHold.findOne({ orderId: razorpayOrderId });
    if (!hold || !isHoldActive(hold)) {
      if (hold) {
        await hold.deleteOne();
      }
      throw new HttpError(410, 'Payment order expired. Please try again.');
    }

    if (hold.userId !== req.user.id) {
      throw new HttpError(403, 'Payment does not belong to this user.');
    }

    const signatureValid = verifySignature({
      orderId: razorpayOrderId,
      paymentId: razorpayPaymentId,
      signature: razorpaySignature,
    });

    if (!signatureValid) {
      throw new HttpError(400, 'Invalid payment signature.');
    }

    const existingBooking = await Booking.findOne({
      $or: [
        { paymentOrderId: razorpayOrderId },
        { paymentId: razorpayPaymentId },
      ],
    });

    if (existingBooking) {
      res.json({
        success: true,
        message: 'Booking already confirmed.',
        data: stripSensitiveFields(existingBooking),
      });
      return;
    }

    const payload = normalizeBookingPayload(req.body);
    const licenseFrontFile = getUploadedFile(req, 'licenseFront');
    const licenseBackFile = getUploadedFile(req, 'licenseBack');
    validateBookingPayload(payload, { licenseFrontFile, licenseBackFile });

    const car = await ensureCarBookable(payload.carId);

    if (String(payload.carId) !== String(hold.carId)) {
      throw new HttpError(400, 'Payment order does not match the selected car.');
    }
    if (payload.pickupDate !== hold.pickupDate || payload.returnDate !== hold.returnDate) {
      throw new HttpError(400, 'Payment order does not match the selected dates.');
    }

    const pricing = calculatePricing(car.pricePerDay, payload.pickupDate, payload.returnDate);

    if (pricing.totalDays !== hold.totalDays) {
      throw new HttpError(400, 'Payment order does not match booking duration.');
    }

    if (Math.abs(pricing.totalAmount - hold.totalAmount) > 0.01) {
      throw new HttpError(400, 'Payment order amount mismatch.');
    }

    const conflict = await hasDateConflict(payload.carId, payload.pickupDate, payload.returnDate, {
      excludeHoldOrderId: razorpayOrderId,
    });
    if (conflict) {
      throw new HttpError(409, 'Selected dates are no longer available.');
    }

    const licenseFront = licenseFrontFile?.path || '';
    const licenseBack = licenseBackFile?.path || '';
    const licenseFrontPublicId = licenseFrontFile?.filename || '';
    const licenseBackPublicId = licenseBackFile?.filename || '';
    const booking = new Booking({
      carId: car.id,
      carNumber: car.carNumber || '',
      carName: car.name,
      image: car.image || '',
      ownerId: car.ownerId || '',
      ownerEmail: car.ownerEmail || '',
      pickupDate: payload.pickupDate,
      returnDate: payload.returnDate,
      totalDays: pricing.totalDays,
      totalPrice: pricing.baseAmount,
      totalAmount: pricing.totalAmount,
      platformFee: pricing.platformFee,
      gstAmount: pricing.gstAmount,
      ownerEarnings: calculateOwnerEarnings(pricing.baseAmount).ownerEarnings,
      ownerPayoutPaid: false,
      status: BOOKING_STATUS.CONFIRMED,
      pickupCode: generatePickupCode(),
      paymentStatus: PAYMENT_STATUS.SUCCESS,
      paymentOrderId: razorpayOrderId,
      paymentId: razorpayPaymentId,
      userId: req.user.id,
      userEmail: req.user.email,
      fullName: payload.fullName,
      phone: payload.phone,
      alternatePhone: payload.alternatePhone,
      email: payload.email,
      dob: payload.dob,
      address: payload.address,
      city: payload.city,
      state: payload.state,
      pincode: payload.pincode,
      aadhaar: payload.aadhaar,
      licenseNumber: payload.licenseNumber,
      licenseFront,
      licenseFrontPublicId,
      licenseBack,
      licenseBackPublicId,
      emergencyName: payload.emergencyName,
      emergencyPhone: payload.emergencyPhone,
      agreeTerms: payload.agreeTerms,
      agreeLicense: payload.agreeLicense,
    });

    await booking.save();
    await hold.deleteOne();

    try {
      let owner = null;
      if (booking.ownerId) {
        owner = await User.findOne({ id: booking.ownerId });
      }
      if (!owner && booking.ownerEmail) {
        owner = await User.findOne({ email: booking.ownerEmail });
      }
      await sendBookingSuccessEmails({ booking, car, user: req.user, owner });
    } catch (mailError) {
      console.error('[Mail] Failed to send booking emails:', mailError?.message || mailError);
    }

    res.status(201).json({
      success: true,
      message: `Booking confirmed! ID: ${booking.bookingId}`,
      data: stripSensitiveFields(booking),
    });
  } catch (error) {
    try {
      const userEmail = req.user?.email || req.body?.email;
      const userName = req.body?.fullName || req.user?.name || 'Customer';
      await sendBookingFailureEmail({
        email: userEmail,
        name: userName,
        reason: getFailureReason(error),
      });
    } catch (mailError) {
      console.error('[Mail] Failed to send booking failure email:', mailError?.message || mailError);
    }
    throw error;
  }
});
module.exports = {
  createPaymentOrder,
  reportPaymentFailure,
  verifyPaymentAndCreateBooking,
};

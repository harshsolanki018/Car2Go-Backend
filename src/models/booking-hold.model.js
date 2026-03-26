const mongoose = require('mongoose');

const HOLD_TTL_SECONDS = 15 * 60;

const bookingHoldSchema = new mongoose.Schema(
  {
    orderId: { type: String, required: true, unique: true, index: true },
    userId: { type: String, required: true, index: true },
    carId: { type: String, required: true, index: true },
    pickupDate: { type: String, required: true },
    returnDate: { type: String, required: true },
    totalDays: { type: Number, required: true, min: 1 },
    totalAmount: { type: Number, required: true, min: 0 },
    platformFee: { type: Number, default: 0, min: 0 },
    gstAmount: { type: Number, default: 0, min: 0 },
    currency: { type: String, default: 'INR' },
    createdAt: { type: Date, default: Date.now, expires: HOLD_TTL_SECONDS },
  },
  { timestamps: false }
);

const BookingHold = mongoose.model('BookingHold', bookingHoldSchema);

module.exports = { BookingHold, HOLD_TTL_SECONDS };

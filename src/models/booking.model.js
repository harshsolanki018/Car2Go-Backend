const mongoose = require('mongoose');
const { BOOKING_STATUS, PAYMENT_STATUS } = require('../constants/enums');
const { getNextSequence } = require('./counter.model');
const { generateBookingId } = require('../utils/id-generator');

const bookingSchema = new mongoose.Schema(
  {
    id: { type: Number, unique: true, index: true },
    bookingId: { type: String, unique: true, index: true },
    carId: { type: String, required: true, index: true },
    carNumber: { type: String, default: '' },
    carName: { type: String, required: true, trim: true },
    image: { type: String, default: '' },
    ownerId: { type: String, index: true },
    ownerEmail: { type: String, trim: true, lowercase: true },
    pickupDate: { type: String, required: true },
    returnDate: { type: String, required: true },
    totalDays: { type: Number, required: true, min: 1 },
    totalPrice: { type: Number, required: true, min: 0 },
    totalAmount: { type: Number, default: 0, min: 0 },
    platformFee: { type: Number, default: 0, min: 0 },
    gstAmount: { type: Number, default: 0, min: 0 },
    ownerEarnings: { type: Number, default: 0, min: 0 },
    ownerPayoutPaid: { type: Boolean, default: false },
    ownerPaidAt: { type: Date, default: null },
    ownerPayoutBatchId: { type: String, default: '' },
    pickupCode: { type: String, default: '' },
    pickupCodeVerifiedAt: { type: Date, default: null },
    paymentStatus: {
      type: String,
      enum: Object.values(PAYMENT_STATUS),
      default: PAYMENT_STATUS.PENDING,
    },
    paymentOrderId: { type: String, index: true, unique: true, sparse: true },
    paymentId: { type: String, index: true, unique: true, sparse: true },
    status: {
      type: String,
      enum: Object.values(BOOKING_STATUS),
      default: BOOKING_STATUS.CONFIRMED,
    },
    rating: { type: Number, default: 0, min: 0, max: 5 },
    review: { type: String, default: '', trim: true, maxlength: 100 },
    userId: { type: String, required: true, index: true },
    userEmail: { type: String, required: true, trim: true, lowercase: true },
    documentsId: { type: mongoose.Schema.Types.ObjectId, default: null, index: true },
  },
  { timestamps: true }
);

bookingSchema.pre('validate', async function ensureIds(next) {
  if (!this.id) {
    this.id = await getNextSequence('booking_id');
  }
  if (!this.bookingId) {
    this.bookingId = generateBookingId();
  }
  next();
});

const Booking = mongoose.model('Booking', bookingSchema);

module.exports = Booking;

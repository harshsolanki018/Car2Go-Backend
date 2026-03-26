const mongoose = require('mongoose');
const { getNextSequence } = require('./counter.model');

const ownerPayoutSchema = new mongoose.Schema(
  {
    id: { type: Number, unique: true, index: true },
    payoutId: { type: String, unique: true, index: true },
    ownerId: { type: String, required: true, index: true },
    ownerEmail: { type: String, trim: true, lowercase: true },
    amountPaid: { type: Number, required: true, min: 0 },
    bookingCount: { type: Number, required: true, min: 0 },
    bookingIds: [{ type: Number }],
    paidAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

ownerPayoutSchema.pre('validate', async function ensurePayoutIds(next) {
  if (!this.id) {
    this.id = await getNextSequence('owner_payout_id');
  }
  if (!this.payoutId) {
    this.payoutId = `PO-${Date.now()}-${this.id || ''}`;
  }
  next();
});

const OwnerPayout = mongoose.model('OwnerPayout', ownerPayoutSchema);

module.exports = OwnerPayout;

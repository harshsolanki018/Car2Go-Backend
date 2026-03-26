const OwnerPayout = require('../models/owner-payout.model');
const asyncHandler = require('../utils/async-handler');
const HttpError = require('../utils/http-error');

const listOwnerPayouts = asyncHandler(async (req, res) => {
  const payouts = await OwnerPayout.find({ ownerId: req.user.id }).sort({ paidAt: -1 });
  res.json({
    success: true,
    data: payouts,
  });
});

const listAdminOwnerPayouts = asyncHandler(async (req, res) => {
  const ownerId = String(req.params.ownerId || '').trim();
  if (!ownerId) {
    throw new HttpError(400, 'Owner ID is required.');
  }
  const payouts = await OwnerPayout.find({ ownerId }).sort({ paidAt: -1 });
  res.json({
    success: true,
    data: payouts,
  });
});

module.exports = {
  listOwnerPayouts,
  listAdminOwnerPayouts,
};

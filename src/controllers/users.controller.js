const User = require('../models/user.model');
const Booking = require('../models/booking.model');
const asyncHandler = require('../utils/async-handler');
const HttpError = require('../utils/http-error');
const { BOOKING_STATUS } = require('../constants/enums');
const { deleteImages } = require('../services/cloudinary-delete.service');

const listUsers = asyncHandler(async (req, res) => {
  const users = await User.find().sort({ createdAt: -1 });
  const bookings = await Booking.find();

  const response = users.map((user) => {
    const userBookings = bookings.filter((b) => b.userEmail === user.email);
    const totalSpent = userBookings
      .filter((b) => b.status === BOOKING_STATUS.COMPLETED)
      .reduce(
        (sum, b) =>
          sum + Number(b.totalAmount && b.totalAmount > 0 ? b.totalAmount : b.totalPrice || 0),
        0
      );

    return {
      ...user.toSafeObject(),
      stats: {
        totalBookings: userBookings.length,
        totalSpent,
      },
    };
  });

  res.json({
    success: true,
    data: response,
  });
});

const toggleUserBlock = asyncHandler(async (req, res) => {
  const userId = String(req.params.id || '').trim();
  const user = await User.findOne({ id: userId });
  if (!user) {
    throw new HttpError(404, 'User not found.');
  }

  user.blocked = !user.blocked;
  await user.save();

  res.json({
    success: true,
    message: user.blocked
      ? 'User blocked successfully.'
      : 'User unblocked successfully.',
    data: user.toSafeObject(),
  });
});

const deleteUser = asyncHandler(async (req, res) => {
  const userId = String(req.params.id || '').trim();
  const user = await User.findOne({ id: userId });
  if (!user) {
    throw new HttpError(404, 'User not found.');
  }

  const hasActiveBooking = await Booking.exists({
    userEmail: user.email,
    status: {
      $in: [
        BOOKING_STATUS.CONFIRMED,
        BOOKING_STATUS.PICKUP_DUE,
        BOOKING_STATUS.ACTIVE,
        BOOKING_STATUS.AWAITING_RETURN,
      ],
    },
  });

  if (hasActiveBooking) {
    throw new HttpError(400, 'Cannot delete user with active bookings.');
  }

  await deleteImages([
    user.licenseImagePublicId,
    user.licenseFrontImagePublicId,
    user.licenseBackImagePublicId,
  ]);

  await user.deleteOne();

  res.json({
    success: true,
    message: 'User deleted successfully.',
  });
});

module.exports = {
  listUsers,
  toggleUserBlock,
  deleteUser,
};

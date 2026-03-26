const Car = require('../models/car.model');
const Booking = require('../models/booking.model');
const User = require('../models/user.model');
const ContactMessage = require('../models/contact-message.model');
const asyncHandler = require('../utils/async-handler');
const { BOOKING_STATUS, CAR_STATUS, USER_ROLES } = require('../constants/enums');
const { normalizeImageUrl } = require('../utils/normalize-image-url');
const { calculateOwnerEarnings } = require('../services/booking.service');

function toNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function percent(part, total) {
  if (!total) {
    return 0;
  }
  return Number(((part / total) * 100).toFixed(1));
}

function formatCurrency(amount) {
  return `Rs. ${new Intl.NumberFormat('en-IN', {
    maximumFractionDigits: 0,
  }).format(amount)}`;
}

function bookingAmount(booking) {
  const totalAmount = toNumber(booking.totalAmount);
  if (totalAmount > 0) {
    return totalAmount;
  }
  return toNumber(booking.totalPrice);
}

function parseDateCandidate(value) {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value <= 0) {
      return null;
    }
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }
    const date = new Date(trimmed);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  return null;
}

function getBookingDate(booking) {
  const candidates = [
    booking.createdAt,
    booking.updatedAt,
    booking.pickupDate,
    booking.id,
  ];

  for (const candidate of candidates) {
    const parsed = parseDateCandidate(candidate);
    if (parsed) {
      return parsed;
    }
  }

  return null;
}

function getRangeWindow(rangeKey) {
  const now = new Date();
  const start = new Date(now);

  if (rangeKey === '7d') {
    start.setDate(start.getDate() - 6);
    start.setHours(0, 0, 0, 0);
  } else if (rangeKey === '30d') {
    start.setDate(start.getDate() - 29);
    start.setHours(0, 0, 0, 0);
  } else if (rangeKey === '1y') {
    start.setFullYear(start.getFullYear() - 1);
    start.setHours(0, 0, 0, 0);
  } else {
    start.setTime(0);
  }

  return { start, end: now };
}

const getAdminStats = asyncHandler(async (req, res) => {
  const selectedRange = ['7d', '30d', '1y', 'overall'].includes(req.query.range)
    ? req.query.range
    : '30d';

  const [cars, allBookings, users] = await Promise.all([
    Car.find(),
    Booking.find(),
    User.find(),
  ]);

  const { start, end } = getRangeWindow(selectedRange);
  const bookings = allBookings.filter((booking) => {
    const bookingDate = getBookingDate(booking);
    if (!bookingDate) {
      return false;
    }
    return bookingDate >= start && bookingDate <= end;
  });

  const approvedCars = cars.filter((c) => c.status === CAR_STATUS.APPROVED).length;
  const pendingCars = cars.filter((c) => c.status === CAR_STATUS.PENDING).length;
  const blockedCars = cars.filter((c) => c.status === CAR_STATUS.BLOCKED).length;
  const rejectedCars = cars.filter((c) => c.status === CAR_STATUS.REJECTED).length;
  const availableCars = approvedCars;
  const bookedCars = pendingCars;
  const maintenanceCars = blockedCars + rejectedCars;

  const confirmed = bookings.filter((b) => b.status === BOOKING_STATUS.CONFIRMED);
  const pickupDue = bookings.filter((b) => b.status === BOOKING_STATUS.PICKUP_DUE);
  const active = bookings.filter((b) => b.status === BOOKING_STATUS.ACTIVE);
  const awaitingReturn = bookings.filter(
    (b) => b.status === BOOKING_STATUS.AWAITING_RETURN
  );
  const completed = bookings.filter(
    (b) => b.status === BOOKING_STATUS.COMPLETED
  );

  const revenueBreakdown = bookings.reduce(
    (acc, b) => {
      acc.gross += bookingAmount(b);
      const userCharges = toNumber(b.platformFee) + toNumber(b.gstAmount);
      acc.userCharges += userCharges;
      const baseAmount = toNumber(b.totalPrice);
      const ownerEarnings = toNumber(b.ownerEarnings);
      const fallbackOwner = calculateOwnerEarnings(baseAmount).ownerEarnings || 0;
      const ownerNet = ownerEarnings > 0 ? ownerEarnings : fallbackOwner;
      const ownerCharges = baseAmount > 0 && ownerNet > 0 ? baseAmount - ownerNet : 0;
      acc.ownerCharges += ownerCharges;
      return acc;
    },
    { gross: 0, userCharges: 0, ownerCharges: 0 }
  );
  const totalRevenue = revenueBreakdown.userCharges + revenueBreakdown.ownerCharges;

  const ratings = bookings
    .map((b) => toNumber(b.rating))
    .filter((rating) => rating > 0);

  const overallRating =
    ratings.length > 0
      ? Number(
          (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1)
        )
      : 0;

  const activeUsersEmails = [
    ...new Set(
      bookings
        .map((b) => String(b.userEmail || '').trim())
        .filter((email) => email.length > 0)
    ),
  ];

  const bookingsPerUser = {};
  const bookingsPerCar = {};
  const carNameById = new Map(cars.map((car) => [car.id, (car.name || '').trim()]));

  bookings.forEach((b) => {
    const email = String(b.userEmail || '').trim();
    if (email) {
      bookingsPerUser[email] = (bookingsPerUser[email] || 0) + 1;
    }

    const carId = String(b.carId || '').trim();
    const bookingCarName = String(b.carName || '').trim();
    const fallbackName = carId
      ? carNameById.get(carId) || bookingCarName || `Car ${carId}`
      : bookingCarName || 'Unknown Car';
    const carKey = carId ? `id:${carId}` : `name:${fallbackName.toLowerCase()}`;

    if (!bookingsPerCar[carKey]) {
      bookingsPerCar[carKey] = {
        label: fallbackName,
        count: 0,
      };
    }

    bookingsPerCar[carKey].count += 1;
  });

  const topUsers = Object.entries(bookingsPerUser)
    .map(([email, count]) => ({ email, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);

  const topCars = Object.values(bookingsPerCar)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const totalCars = cars.length;
  const totalBookings = bookings.length;
  const totalUsers = users.length;
  const totalOwners = users.filter((u) => u.role === USER_ROLES.OWNER).length;
  const blockedOwners = users.filter(
    (u) => u.role === USER_ROLES.OWNER && u.blocked
  ).length;

  const response = {
    selectedRange,
    rangeStartDisplay: selectedRange === 'overall' ? 'All time' : start.toLocaleDateString(),
    rangeEndDisplay: end.toLocaleDateString(),
    totalBookingsAll: allBookings.length,
    lastUpdated: new Date().toLocaleString(),
    revenueDisplay: formatCurrency(totalRevenue),
    revenueBreakdown: {
      gross: revenueBreakdown.gross,
      userCharges: revenueBreakdown.userCharges,
      ownerCharges: revenueBreakdown.ownerCharges,
      grossDisplay: formatCurrency(revenueBreakdown.gross),
      userChargesDisplay: formatCurrency(revenueBreakdown.userCharges),
      ownerChargesDisplay: formatCurrency(revenueBreakdown.ownerCharges),
    },
    overview: {
      totalCars,
      approvedCars,
      pendingCars,
      blockedCars,
      rejectedCars,
      availableCars,
      bookedCars,
      maintenanceCars,
      totalBookings,
      totalRevenue,
      overallRating,
      availabilityRate: percent(availableCars, totalCars),
      utilizationRate: percent(bookedCars, totalCars),
    },
    ownerStats: {
      totalOwners,
      blockedOwners,
      pendingCarRequests: pendingCars,
    },
    userStats: {
      totalUsers,
      activeUsers: activeUsersEmails.length,
      activeUserRate: percent(activeUsersEmails.length, totalUsers),
      avgBookingsPerUser:
        totalUsers > 0 ? Number((totalBookings / totalUsers).toFixed(1)) : 0,
    },
    bookingStats: {
      confirmed: confirmed.length,
      pickupDue: pickupDue.length,
      active: active.length,
      awaitingReturn: awaitingReturn.length,
      completed: completed.length,
      confirmedRate: percent(confirmed.length, totalBookings),
      pickupDueRate: percent(pickupDue.length, totalBookings),
      activeRate: percent(active.length, totalBookings),
      awaitingReturnRate: percent(awaitingReturn.length, totalBookings),
      completionRate: percent(completed.length, totalBookings),
    },
    topUsers,
    topCars,
  };

  res.json({
    success: true,
    data: response,
  });
});

const getAdminDashboard = asyncHandler(async (req, res) => {
  const [cars, bookings, users, messages] = await Promise.all([
    Car.find(),
    Booking.find(),
    User.find(),
    ContactMessage.find(),
  ]);

  const confirmedBookings = bookings.filter(
    (b) => b.status === BOOKING_STATUS.CONFIRMED
  );
  const activeBookings = bookings.filter(
    (b) => b.status === BOOKING_STATUS.ACTIVE
  );
  const awaitingReturnBookings = bookings.filter(
    (b) => b.status === BOOKING_STATUS.AWAITING_RETURN
  );
  const completedBookings = bookings.filter(
    (b) => b.status === BOOKING_STATUS.COMPLETED
  );

  const approvedCars = cars.filter((c) => c.status === CAR_STATUS.APPROVED).length;
  const pendingCars = cars.filter((c) => c.status === CAR_STATUS.PENDING).length;
  const blockedCars = cars.filter((c) => c.status === CAR_STATUS.BLOCKED).length;
  const rejectedCars = cars.filter((c) => c.status === CAR_STATUS.REJECTED).length;

  const totalOwners = users.filter((u) => u.role === USER_ROLES.OWNER).length;

  const ownerMessages = messages.filter(
    (m) => m.senderRole === USER_ROLES.OWNER
  ).length;
  const userMessages = messages.length - ownerMessages;

  const totalRevenue = bookings.reduce((sum, b) => sum + bookingAmount(b), 0);
  const totalRevenueDisplay = formatCurrency(totalRevenue);

  const totalCompanyCharges = bookings.reduce((sum, booking) => {
    const baseAmount = toNumber(booking.totalPrice);
    const userCharges = toNumber(booking.platformFee) + toNumber(booking.gstAmount);

    const ownerEarnings = toNumber(booking.ownerEarnings);
    const fallbackOwner = calculateOwnerEarnings(baseAmount).ownerEarnings || 0;
    const ownerNet = ownerEarnings > 0 ? ownerEarnings : fallbackOwner;
    const ownerCharges = baseAmount > 0 && ownerNet > 0 ? baseAmount - ownerNet : 0;

    return sum + userCharges + ownerCharges;
  }, 0);

  const totalUsers = users.filter((u) => u.role === USER_ROLES.USER).length;

  const stats = [
    { label: 'Total Users', value: totalUsers },
    { label: 'Total Owners', value: totalOwners },
    { label: 'Total Cars', value: cars.length },
    { label: 'Total Bookings', value: bookings.length },
  ];

  const carStats = cars.map((car) => {
    const carBookings = bookings.filter((b) => b.carId === car.id);

    const carRevenue = carBookings.reduce(
      (sum, b) => sum + bookingAmount(b),
      0
    );

    const ratings = carBookings
      .map((b) => b.rating)
      .filter((r) => r > 0);

    const avgRating =
      ratings.length > 0
        ? Number(
            (
              ratings.reduce((a, b) => a + b, 0) / ratings.length
            ).toFixed(1)
          )
        : 0;

    return {
      id: car.id,
      carNumber: car.carNumber || 'N/A',
      name: car.name,
      image: normalizeImageUrl(car.image),
      bookings: carBookings.length,
      revenue: carRevenue,
      revenueDisplay: formatCurrency(carRevenue),
      avgRating,
      status: car.status,
    };
  });

  const allRatings = bookings
    .map((b) => b.rating)
    .filter((r) => r > 0);

  const overallRating =
    allRatings.length > 0
      ? Number((allRatings.reduce((a, b) => a + b, 0) / allRatings.length).toFixed(1))
      : 0;

  res.json({
    success: true,
    data: {
      stats,
      carStats,
      overallRating,
      companyEarnings: totalCompanyCharges,
      companyEarningsDisplay: formatCurrency(totalCompanyCharges),
    },
  });
});

module.exports = {
  getAdminStats,
  getAdminDashboard,
};

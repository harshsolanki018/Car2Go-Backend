const Car = require('../models/car.model');
const Booking = require('../models/booking.model');
const User = require('../models/user.model');
const HomeFeaturedConfig = require('../models/home-featured-config.model');
const asyncHandler = require('../utils/async-handler');
const HttpError = require('../utils/http-error');
const { CAR_STATUS, BOOKING_STATUS, USER_ROLES } = require('../constants/enums');
const { normalizeImageUrl } = require('../utils/normalize-image-url');

const MAX_HOME_CARS = 3;
const HOME_KEY = 'home_featured_cars';

async function getConfig() {
  return HomeFeaturedConfig.findOne({ key: HOME_KEY });
}

async function getBlockedOwnerIds() {
  const owners = await User.find({ role: USER_ROLES.OWNER, blocked: true }).select('id');
  return owners.map((owner) => owner.id);
}

function sanitizeCarData(car) {
  const data = car?.toObject ? car.toObject() : { ...car };
  delete data.ownerLicenseImage;
  delete data.ownerLicenseFrontImage;
  delete data.ownerLicenseBackImage;
  delete data.rcBookImage;
  delete data.pucCertificateImage;
  if (data.image) {
    data.image = normalizeImageUrl(data.image);
  }
  return data;
}

function formatCount(value) {
  if (!Number.isFinite(value) || value < 0) {
    return '0';
  }
  return new Intl.NumberFormat('en-IN').format(value);
}

const getHomeFeaturedCars = asyncHandler(async (req, res) => {
  const blockedOwnerIds = await getBlockedOwnerIds();
  const ownerFilter = blockedOwnerIds.length
    ? { ownerId: { $nin: blockedOwnerIds } }
    : {};
  const selectableCars = await Car.find({
    status: CAR_STATUS.APPROVED,
    ...ownerFilter,
  });
  const config = await getConfig();
  const featuredIds = config?.carIds || [];

  const selectedCars = featuredIds
    .map((id) => selectableCars.find((car) => car.id === id))
    .filter(Boolean);

  const fallbackCars = selectableCars.filter(
    (car) => !featuredIds.includes(car.id)
  );

  const cars = [...selectedCars, ...fallbackCars]
    .slice(0, MAX_HOME_CARS)
    .map(sanitizeCarData);

  res.json({
    success: true,
    data: cars,
  });
});

const getHomeStatusBar = asyncHandler(async (req, res) => {
  const cars = await Car.find();
  const users = await User.find();
  const bookings = await Booking.find();
  const blockedOwnerIds = await getBlockedOwnerIds();
  const visibleCars = blockedOwnerIds.length
    ? cars.filter((car) => !blockedOwnerIds.includes(car.ownerId))
    : cars;

  const approvedCars = visibleCars.filter(
    (car) => car.status === CAR_STATUS.APPROVED
  );

  const availableCars = approvedCars.length;

  const customerEmails = new Set();
  users.forEach((user) => {
    if (user.email) {
      customerEmails.add(user.email.trim().toLowerCase());
    }
  });
  bookings.forEach((booking) => {
    if (booking.userEmail) {
      customerEmails.add(booking.userEmail.trim().toLowerCase());
    }
  });

  const cityKeys = new Set(
    approvedCars
      .map((car) => {
        if (car.city) {
          return String(car.city).trim().toLowerCase();
        }
        if (car.location && typeof car.location === 'string') {
          const parts = car.location.split(',').map((part) => part.trim());
          return String(parts[0] || '').toLowerCase();
        }
        return '';
      })
      .filter(Boolean)
  );

  const completedRides = bookings.filter(
    (booking) => booking.status === BOOKING_STATUS.COMPLETED
  ).length;

  const statusBarStats = [
    { label: 'Cars Available', value: formatCount(availableCars) },
    { label: 'Happy Customers', value: formatCount(customerEmails.size) },
    { label: 'Cities Covered', value: formatCount(cityKeys.size) },
    { label: 'Completed Rides', value: formatCount(completedRides) },
  ];

  res.json({
    success: true,
    data: statusBarStats,
  });
});

const getAdminHomeFeaturedCars = asyncHandler(async (req, res) => {
  const cars = await Car.find().sort({ id: -1 });
  const config = await getConfig();

  res.json({
    success: true,
    data: {
      cars,
      featuredIds: config?.carIds || [],
      updatedAt: config?.updatedAt || null,
    },
  });
});

const saveAdminHomeFeaturedCars = asyncHandler(async (req, res) => {
  const rawIds = Array.isArray(req.body.carIds) ? req.body.carIds : [];
  const carIds = rawIds.map((id) => String(id || '').trim()).filter(Boolean);

  if (carIds.length > MAX_HOME_CARS) {
    throw new HttpError(
      400,
      `You can select only ${MAX_HOME_CARS} cars for the Home page.`
    );
  }

  const selectableCars = await Car.find({
    status: CAR_STATUS.APPROVED,
  });
  const selectableIds = new Set(selectableCars.map((car) => car.id));
  const validIds = carIds
    .filter((id) => selectableIds.has(id))
    .slice(0, MAX_HOME_CARS);

  const updated = await HomeFeaturedConfig.findOneAndUpdate(
    { key: HOME_KEY },
    {
      key: HOME_KEY,
      carIds: validIds,
      updatedAt: new Date(),
    },
    { new: true, upsert: true }
  );

  res.json({
    success: true,
    message: 'Home featured cars updated.',
    data: updated,
  });
});

const clearAdminHomeFeaturedCars = asyncHandler(async (req, res) => {
  await HomeFeaturedConfig.deleteOne({ key: HOME_KEY });

  res.json({
    success: true,
    message:
      'Manual selection cleared. Home page will show the first 3 approved cars automatically.',
  });
});

module.exports = {
  getHomeFeaturedCars,
  getHomeStatusBar,
  getAdminHomeFeaturedCars,
  saveAdminHomeFeaturedCars,
  clearAdminHomeFeaturedCars,
};


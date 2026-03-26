const Booking = require('../models/booking.model');
const { BOOKING_STATUS } = require('../constants/enums');

const AUTO_COMPLETE_INTERVAL_MS = 60 * 1000;

function getLocalDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function toDateKey(value) {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return getLocalDateKey(parsed);
}

async function autoCompleteDueBookings() {
  const todayKey = getLocalDateKey();
  const activeBookings = await Booking.find({
    status: {
      $in: [
        BOOKING_STATUS.CONFIRMED,
        BOOKING_STATUS.PICKUP_DUE,
        BOOKING_STATUS.ACTIVE,
      ],
    },
  });

  if (activeBookings.length === 0) {
    return { updatedCount: 0, activatedCount: 0, awaitingReturnCount: 0 };
  }

  let activatedCount = 0;
  let pickupDueCount = 0;
  let awaitingReturnCount = 0;

  for (const booking of activeBookings) {
    const pickupKey = toDateKey(booking.pickupDate);
    const returnKey = toDateKey(booking.returnDate);

    let nextStatus = booking.status;

    if (pickupKey && pickupKey <= todayKey && booking.status === BOOKING_STATUS.CONFIRMED) {
      nextStatus = BOOKING_STATUS.PICKUP_DUE;
    }

    if (returnKey && returnKey <= todayKey && booking.status === BOOKING_STATUS.ACTIVE) {
      nextStatus = BOOKING_STATUS.AWAITING_RETURN;
    }

    if (nextStatus === booking.status) {
      continue;
    }

    booking.status = nextStatus;
    await booking.save();

    if (nextStatus === BOOKING_STATUS.ACTIVE) {
      activatedCount += 1;
    } else if (nextStatus === BOOKING_STATUS.PICKUP_DUE) {
      pickupDueCount += 1;
    } else if (nextStatus === BOOKING_STATUS.AWAITING_RETURN) {
      awaitingReturnCount += 1;
    }
  }

  return {
    updatedCount: activatedCount + pickupDueCount + awaitingReturnCount,
    activatedCount,
    pickupDueCount,
    awaitingReturnCount,
  };
}

function startBookingAutoCompleteScheduler() {
  let running = false;

  const tick = async () => {
    if (running) {
      return;
    }

    running = true;
    try {
      const result = await autoCompleteDueBookings();
        if (result.updatedCount > 0) {
          // eslint-disable-next-line no-console
          console.log(
            `[Scheduler] Auto-updated ${result.updatedCount} booking(s): pickupDue=${result.pickupDueCount}, active=${result.activatedCount}, awaitingReturn=${result.awaitingReturnCount}.`
          );
        }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('[Scheduler] Auto-complete booking check failed:', error?.message || error);
    } finally {
      running = false;
    }
  };

  const intervalId = setInterval(() => {
    void tick();
  }, AUTO_COMPLETE_INTERVAL_MS);

  if (typeof intervalId.unref === 'function') {
    intervalId.unref();
  }

  return {
    stop() {
      clearInterval(intervalId);
    },
  };
}

module.exports = {
  autoCompleteDueBookings,
  startBookingAutoCompleteScheduler,
};

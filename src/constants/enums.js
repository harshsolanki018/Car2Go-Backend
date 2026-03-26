const USER_ROLES = {
  ADMIN: 'Admin',
  OWNER: 'Owner',
  USER: 'User',
};

const CAR_STATUS = {
  PENDING: 'Pending',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  BLOCKED: 'Blocked',
};

const BOOKING_STATUS = {
  CONFIRMED: 'Confirmed',
  PICKUP_DUE: 'Pickup Due',
  ACTIVE: 'Active',
  AWAITING_RETURN: 'Awaiting Return',
  COMPLETED: 'Completed',
};

const MESSAGE_STATUS = {
  NEW: 'New',
  IN_PROGRESS: 'In Progress',
  RESOLVED: 'Resolved',
};

const PAYMENT_STATUS = {
  PENDING: 'Pending',
  SUCCESS: 'Success',
  FAILED: 'Failed',
};

module.exports = {
  USER_ROLES,
  CAR_STATUS,
  BOOKING_STATUS,
  MESSAGE_STATUS,
  PAYMENT_STATUS,
};

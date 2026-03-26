function random4Digit() {
  return Math.floor(1000 + Math.random() * 9000);
}

function currentDatePart() {
  const now = new Date();
  const year = now.getFullYear().toString();
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const day = now.getDate().toString().padStart(2, '0');
  return `${year}${month}${day}`;
}

function generateBookingId() {
  return `BK-${currentDatePart()}-${random4Digit()}`;
}

function generateTicketId() {
  return `TKT-${Date.now()}`;
}

function generatePrefixedId(prefix) {
  return `${prefix}-${Date.now()}`;
}

function generateUserId() {
  return generatePrefixedId('USR');
}

function generateOwnerId() {
  return generatePrefixedId('OWN');
}

function generateCarId() {
  return generatePrefixedId('CR');
}

module.exports = {
  generateBookingId,
  generateTicketId,
  generateUserId,
  generateOwnerId,
  generateCarId,
};

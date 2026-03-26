const Car = require('../models/car.model');

function normalizeCarNumber(value) {
  return String(value || '').trim().toUpperCase();
}

async function reportDuplicateCarNumbers() {
  const cars = await Car.find({}, { id: 1, name: 1, carNumber: 1 }).lean();
  const groupedByCarNumber = new Map();

  cars.forEach((car) => {
    const normalized = normalizeCarNumber(car.carNumber);
    if (!normalized) {
      return;
    }

    const list = groupedByCarNumber.get(normalized) || [];
    list.push(car);
    groupedByCarNumber.set(normalized, list);
  });

  const duplicates = [...groupedByCarNumber.entries()].filter(
    ([, group]) => group.length > 1
  );

  if (duplicates.length === 0) {
    // eslint-disable-next-line no-console
    console.log('[Startup][Integrity] No duplicate car numbers found.');
    return { duplicateGroups: 0, duplicateCars: 0 };
  }

  const duplicateCars = duplicates.reduce((sum, [, group]) => sum + group.length, 0);

  // eslint-disable-next-line no-console
  console.warn(
    `[Startup][Integrity] Duplicate car numbers detected: ${duplicates.length} group(s), ${duplicateCars} car record(s).`
  );

  duplicates.forEach(([carNumber, group]) => {
    const records = group
      .map((car) => `id=${car.id}, name="${String(car.name || '').trim() || 'N/A'}"`)
      .join(' | ');
    // eslint-disable-next-line no-console
    console.warn(`[Startup][Integrity] carNumber="${carNumber}" -> ${records}`);
  });

  return { duplicateGroups: duplicates.length, duplicateCars };
}

module.exports = {
  reportDuplicateCarNumbers,
};

const mongoose = require('mongoose');
const Booking = require('../models/booking.model');
const BookingDocument = require('../models/booking-document.model');
const { connectDatabase } = require('../config/database');
const { buildLegacyDocumentFields } = require('../services/booking-documents.service');

const LEGACY_UNSET_FIELDS = [
  'fullName',
  'phone',
  'alternatePhone',
  'email',
  'dob',
  'address',
  'city',
  'state',
  'pincode',
  'aadhaar',
  'licenseNumber',
  'licenseFront',
  'licenseFrontPublicId',
  'licenseBack',
  'licenseBackPublicId',
  'emergencyName',
  'emergencyPhone',
  'agreeTerms',
  'agreeLicense',
];

function hasDocumentData(payload) {
  return Object.values(payload).some((value) => {
    if (typeof value === 'boolean') {
      return value;
    }
    return String(value || '').trim().length > 0;
  });
}

async function migrate() {
  await connectDatabase();

  const cursor = Booking.find({
    $or: [{ documentsId: { $exists: false } }, { documentsId: null }],
  }).cursor();

  let processed = 0;
  let migrated = 0;
  let skipped = 0;

  for await (const booking of cursor) {
    processed += 1;
    const legacyPayload = buildLegacyDocumentFields(booking);
    if (!hasDocumentData(legacyPayload)) {
      skipped += 1;
      continue;
    }

    const document = await BookingDocument.create({
      bookingId: booking.bookingId || '',
      bookingNumericId: booking.id || null,
      ...legacyPayload,
    });

    const unsetPayload = LEGACY_UNSET_FIELDS.reduce((acc, field) => {
      acc[field] = '';
      return acc;
    }, {});

    await Booking.updateOne(
      { _id: booking._id },
      {
        $set: { documentsId: document._id },
        $unset: unsetPayload,
      }
    );

    migrated += 1;
  }

  console.log(
    `[Migration] Processed=${processed}, Migrated=${migrated}, Skipped=${skipped}`
  );
  await mongoose.connection.close();
  process.exit(0);
}

migrate().catch((error) => {
  console.error('[Migration] Failed:', error);
  process.exit(1);
});

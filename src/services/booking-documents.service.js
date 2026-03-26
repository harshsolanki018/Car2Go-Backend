const BookingDocument = require('../models/booking-document.model');

const DOCUMENT_FIELDS = [
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

function pickDocumentFields(source) {
  const data = source || {};
  return DOCUMENT_FIELDS.reduce((acc, field) => {
    if (typeof data[field] !== 'undefined') {
      acc[field] = data[field];
    }
    return acc;
  }, {});
}

function buildLegacyDocumentFields(booking) {
  const base = booking || {};
  return {
    fullName: base.fullName || '',
    phone: base.phone || '',
    alternatePhone: base.alternatePhone || '',
    email: base.email || '',
    dob: base.dob || '',
    address: base.address || '',
    city: base.city || '',
    state: base.state || '',
    pincode: base.pincode || '',
    aadhaar: base.aadhaar || '',
    licenseNumber: base.licenseNumber || '',
    licenseFront: base.licenseFront || '',
    licenseFrontPublicId: base.licenseFrontPublicId || '',
    licenseBack: base.licenseBack || '',
    licenseBackPublicId: base.licenseBackPublicId || '',
    emergencyName: base.emergencyName || '',
    emergencyPhone: base.emergencyPhone || '',
    agreeTerms: base.agreeTerms ?? false,
    agreeLicense: base.agreeLicense ?? false,
  };
}

function mergeBookingWithDocuments(booking, documents) {
  if (!booking) {
    return booking;
  }
  const base = booking?.toObject ? booking.toObject() : { ...booking };
  const docFields = documents ? pickDocumentFields(documents) : buildLegacyDocumentFields(base);
  return {
    ...base,
    ...docFields,
  };
}

async function attachDocumentsToBookings(bookings) {
  if (!Array.isArray(bookings) || bookings.length === 0) {
    return [];
  }

  const documentIds = bookings
    .map((booking) => booking?.documentsId)
    .filter(Boolean)
    .map((id) => String(id));

  let documents = [];
  if (documentIds.length > 0) {
    documents = await BookingDocument.find({ _id: { $in: documentIds } }).lean();
  }

  const documentLookup = new Map(
    documents.map((doc) => [String(doc._id), doc])
  );

  return bookings.map((booking) =>
    mergeBookingWithDocuments(booking, documentLookup.get(String(booking.documentsId)))
  );
}

async function attachDocumentsToBooking(booking) {
  if (!booking) {
    return booking;
  }

  let document = null;
  if (booking.documentsId) {
    document = await BookingDocument.findById(booking.documentsId).lean();
  }

  return mergeBookingWithDocuments(booking, document);
}

async function createBookingDocument({
  booking,
  payload,
  licenseFront,
  licenseBack,
  licenseFrontPublicId,
  licenseBackPublicId,
}) {
  const source = payload || {};
  const documentPayload = {
    bookingId: booking?.bookingId || '',
    bookingNumericId: booking?.id || null,
    fullName: source.fullName || '',
    phone: source.phone || '',
    alternatePhone: source.alternatePhone || '',
    email: source.email || '',
    dob: source.dob || '',
    address: source.address || '',
    city: source.city || '',
    state: source.state || '',
    pincode: source.pincode || '',
    aadhaar: source.aadhaar || '',
    licenseNumber: source.licenseNumber || '',
    licenseFront: licenseFront || source.licenseFront || '',
    licenseFrontPublicId: licenseFrontPublicId || source.licenseFrontPublicId || '',
    licenseBack: licenseBack || source.licenseBack || '',
    licenseBackPublicId: licenseBackPublicId || source.licenseBackPublicId || '',
    emergencyName: source.emergencyName || '',
    emergencyPhone: source.emergencyPhone || '',
    agreeTerms: source.agreeTerms ?? false,
    agreeLicense: source.agreeLicense ?? false,
  };

  return BookingDocument.create(documentPayload);
}

module.exports = {
  attachDocumentsToBookings,
  attachDocumentsToBooking,
  createBookingDocument,
  mergeBookingWithDocuments,
  pickDocumentFields,
  buildLegacyDocumentFields,
};

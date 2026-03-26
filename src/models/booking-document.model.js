const mongoose = require('mongoose');

const bookingDocumentSchema = new mongoose.Schema(
  {
    bookingId: { type: String, index: true },
    bookingNumericId: { type: Number, index: true },
    fullName: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    alternatePhone: { type: String, default: '', trim: true },
    email: { type: String, default: '', trim: true, lowercase: true },
    dob: { type: String, default: '' },
    address: { type: String, default: '', trim: true },
    city: { type: String, default: '', trim: true },
    state: { type: String, default: '', trim: true },
    pincode: { type: String, default: '', trim: true },
    aadhaar: { type: String, default: '', trim: true },
    licenseNumber: { type: String, default: '', trim: true },
    licenseFront: { type: String, default: '' },
    licenseFrontPublicId: { type: String, default: '' },
    licenseBack: { type: String, default: '' },
    licenseBackPublicId: { type: String, default: '' },
    emergencyName: { type: String, default: '', trim: true },
    emergencyPhone: { type: String, default: '', trim: true },
    agreeTerms: { type: Boolean, default: false },
    agreeLicense: { type: Boolean, default: false },
  },
  { timestamps: true }
);

const BookingDocument = mongoose.model('BookingDocument', bookingDocumentSchema);

module.exports = BookingDocument;

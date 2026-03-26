const mongoose = require('mongoose');
const { CAR_STATUS } = require('../constants/enums');
const { generateCarId } = require('../utils/id-generator');

const carSchema = new mongoose.Schema(
  {
    id: { type: String, unique: true, index: true },
    ownerId: { type: String, index: true },
    ownerEmail: { type: String, trim: true, lowercase: true },
    ownerName: { type: String, required: true, trim: true },
    ownerContact: { type: String, required: true, trim: true },
    ownerLicenseImage: { type: String, default: '' },
    ownerLicenseImagePublicId: { type: String, default: '' },
    ownerLicenseFrontImage: { type: String, default: '' },
    ownerLicenseFrontImagePublicId: { type: String, default: '' },
    ownerLicenseBackImage: { type: String, default: '' },
    ownerLicenseBackImagePublicId: { type: String, default: '' },
    name: { type: String, required: true, trim: true },
    carNumber: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      unique: true,
      index: true,
    },
    image: { type: String, default: '' },
    imagePublicId: { type: String, default: '' },
    rcBookImage: { type: String, default: '' },
    rcBookImagePublicId: { type: String, default: '' },
    pucCertificateImage: { type: String, default: '' },
    pucCertificateImagePublicId: { type: String, default: '' },
    state: { type: String, trim: true },
    city: { type: String, trim: true },
    area: { type: String, trim: true },
    location: { type: String, required: true, trim: true },
    fuelType: {
      type: String,
      enum: ['Petrol', 'Diesel', 'Electric'],
      required: true,
    },
    transmission: {
      type: String,
      enum: ['Manual', 'Automatic'],
      required: true,
    },
    seats: { type: Number, required: true, min: 1 },
    pricePerDay: { type: Number, required: true, min: 0 },
    description: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: Object.values(CAR_STATUS),
      default: CAR_STATUS.PENDING,
    },
  },
  { timestamps: true }
);

carSchema.pre('validate', function generateCustomId(next) {
  if (!this.id) {
    this.id = generateCarId();
  }
  next();
});

const Car = mongoose.model('Car', carSchema);

module.exports = Car;

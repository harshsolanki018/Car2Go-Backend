const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { USER_ROLES } = require('../constants/enums');
const { generateOwnerId, generateUserId } = require('../utils/id-generator');

const userSchema = new mongoose.Schema(
  {
    id: { type: String, unique: true, index: true },
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    phone: { type: String, required: true, trim: true },
    licenseNumber: { type: String, trim: true, uppercase: true, default: '' },
    licenseImage: { type: String, default: '' },
    licenseImagePublicId: { type: String, default: '' },
    licenseFrontImage: { type: String, default: '' },
    licenseFrontImagePublicId: { type: String, default: '' },
    licenseBackImage: { type: String, default: '' },
    licenseBackImagePublicId: { type: String, default: '' },
    aadhaarNumber: { type: String, trim: true, default: '' },
    address: { type: String, trim: true, default: '' },
    gender: { type: String, enum: ['Male', 'Female', ''], default: '' },
    age: { type: Number, min: 18, max: 84, default: null },
    password: { type: String, required: true },
    role: {
      type: String,
      enum: Object.values(USER_ROLES),
      default: USER_ROLES.USER,
    },
    blocked: { type: Boolean, default: false },
    joinDate: { type: Date, default: Date.now },
    lastLogin: { type: Date, default: null },
  },
  { timestamps: true }
);

userSchema.pre('validate', function generateCustomId(next) {
  if (!this.id) {
    this.id =
      this.role === USER_ROLES.OWNER ? generateOwnerId() : generateUserId();
  }
  next();
});

userSchema.pre('save', async function hashPassword(next) {
  if (!this.isModified('password')) {
    next();
    return;
  }
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

userSchema.methods.comparePassword = function comparePassword(rawPassword) {
  return bcrypt.compare(rawPassword, this.password);
};

userSchema.methods.toSafeObject = function toSafeObject() {
  return {
    id: this.id,
    name: this.name,
    email: this.email,
    phone: this.phone,
      licenseNumber: this.licenseNumber || '',
      licenseFrontImage: this.licenseFrontImage || '',
      licenseBackImage: this.licenseBackImage || '',
      licenseFrontImagePublicId: this.licenseFrontImagePublicId || '',
      licenseBackImagePublicId: this.licenseBackImagePublicId || '',
      licenseImagePublicId: this.licenseImagePublicId || '',
    aadhaarNumber: this.aadhaarNumber || '',
    address: this.address || '',
    gender: this.gender || '',
    age: this.age ?? null,
    role: this.role,
    blocked: this.blocked,
    joinDate: this.joinDate,
    lastLogin: this.lastLogin,
  };
};

const User = mongoose.model('User', userSchema);

module.exports = User;

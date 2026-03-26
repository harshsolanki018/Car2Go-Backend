const crypto = require('crypto');
const User = require('../models/user.model');
const EmailOtp = require('../models/email-otp.model');
const PasswordResetOtp = require('../models/password-reset-otp.model');
const asyncHandler = require('../utils/async-handler');
const HttpError = require('../utils/http-error');
const { USER_ROLES } = require('../constants/enums');
const { signAccessToken } = require('../services/token.service');
const { sendOtpEmail, sendPasswordResetOtpEmail } = require('../services/otp-email.service');
const env = require('../config/env');

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidPhone(phone) {
  return /^[0-9]{10}$/.test(phone);
}

function isStrongPassword(password) {
  return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/.test(password);
}

function getAuthCookieOptions() {
  const isProduction = env.nodeEnv === 'production';
  return {
    httpOnly: true,
    sameSite: isProduction ? 'none' : 'lax',
    secure: isProduction,
    path: '/',
  };
}

function resolveRole(requestedRole) {
  return requestedRole === USER_ROLES.OWNER.toLowerCase()
    ? USER_ROLES.OWNER
    : USER_ROLES.USER;
}

function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function hashOtp(otp) {
  return crypto.createHash('sha256').update(String(otp)).digest('hex');
}

function isOtpValid(inputOtp, hashedOtp) {
  return hashOtp(inputOtp) === hashedOtp;
}

const OTP_TTL_MINUTES = Number(process.env.OTP_TTL_MINUTES || 10);
const OTP_MAX_ATTEMPTS = Number(process.env.OTP_MAX_ATTEMPTS || 5);
const OTP_MAX_RESENDS = Number(process.env.OTP_MAX_RESENDS || 2);
const OTP_RESEND_INTERVAL_SECONDS = Number(process.env.OTP_RESEND_INTERVAL_SECONDS || 60);

const register = asyncHandler(async (req, res) => {
  const name = String(req.body.name || '').trim();
  const email = String(req.body.email || '').trim().toLowerCase();
  const phone = String(req.body.phone || '').trim();
  const password = String(req.body.password || '');
  const requestedRole = String(req.body.role || '').trim().toLowerCase();

  if (!name || !email || !phone || !password) {
    throw new HttpError(400, 'Please fill all required fields.');
  }

  if (!isValidEmail(email)) {
    throw new HttpError(400, 'Invalid email format.');
  }

  if (!isValidPhone(phone)) {
    throw new HttpError(400, 'Phone number must be 10 digits.');
  }

  if (!isStrongPassword(password)) {
    throw new HttpError(
      400,
      'Password must be at least 8 characters and include uppercase, lowercase, number, and special character.'
    );
  }

  const existing = await User.findOne({ email });
  if (existing) {
    throw new HttpError(409, 'Email already registered.');
  }

  const role = resolveRole(requestedRole);
  const existingOtp = await EmailOtp.findOne({ email, role });
  const otp = generateOtp();
  const otpHash = hashOtp(otp);
  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);
  const now = new Date();

  if (existingOtp && existingOtp.expiresAt.getTime() > Date.now()) {
    if (
      existingOtp.lastSentAt &&
      now.getTime() - existingOtp.lastSentAt.getTime() < OTP_RESEND_INTERVAL_SECONDS * 1000
    ) {
      const remaining = Math.ceil(
        (OTP_RESEND_INTERVAL_SECONDS * 1000 - (now.getTime() - existingOtp.lastSentAt.getTime())) /
          1000
      );
      throw new HttpError(429, `Please wait ${remaining} seconds before requesting a new OTP.`);
    }

    if (existingOtp.resendCount >= OTP_MAX_RESENDS) {
      throw new HttpError(429, 'OTP resend limit reached. Please try again later.');
    }
    existingOtp.otpHash = otpHash;
    existingOtp.attempts = 0;
    existingOtp.expiresAt = expiresAt;
    existingOtp.resendCount += 1;
    existingOtp.lastSentAt = now;
    await existingOtp.save();
  } else {
    await EmailOtp.findOneAndUpdate(
      { email, role },
      { otpHash, attempts: 0, resendCount: 0, lastSentAt: now, expiresAt },
      { upsert: true, new: true }
    );
  }

  try {
    await sendOtpEmail({ email, name, otp, role });
  } catch (error) {
    await EmailOtp.deleteOne({ email, role });
    throw new HttpError(500, 'Failed to send OTP email. Please try again.');
  }

  res.status(200).json({
    success: true,
    message: 'OTP sent to your email. Please verify to complete registration.',
    data: { retryAfterSeconds: OTP_RESEND_INTERVAL_SECONDS },
  });
});

const resendOtp = asyncHandler(async (req, res) => {
  const name = String(req.body.name || '').trim();
  const email = String(req.body.email || '').trim().toLowerCase();
  const requestedRole = String(req.body.role || '').trim().toLowerCase();

  if (!email) {
    throw new HttpError(400, 'Email is required.');
  }

  if (!isValidEmail(email)) {
    throw new HttpError(400, 'Invalid email format.');
  }

  const role = resolveRole(requestedRole);
  const existing = await User.findOne({ email });
  if (existing) {
    throw new HttpError(409, 'Email already registered.');
  }

  const otpRecord = await EmailOtp.findOne({ email, role });
  if (!otpRecord) {
    throw new HttpError(400, 'OTP not found. Please register again.');
  }

  if (otpRecord.expiresAt.getTime() < Date.now()) {
    await otpRecord.deleteOne();
    throw new HttpError(400, 'OTP expired. Please register again.');
  }

  if (otpRecord.resendCount >= OTP_MAX_RESENDS) {
    throw new HttpError(429, 'OTP resend limit reached.');
  }

  const now = new Date();
  if (
    otpRecord.lastSentAt &&
    now.getTime() - otpRecord.lastSentAt.getTime() < OTP_RESEND_INTERVAL_SECONDS * 1000
  ) {
    const remaining = Math.ceil(
      (OTP_RESEND_INTERVAL_SECONDS * 1000 - (now.getTime() - otpRecord.lastSentAt.getTime())) /
        1000
    );
    throw new HttpError(429, `Please wait ${remaining} seconds before resending OTP.`);
  }

  const otp = generateOtp();
  otpRecord.otpHash = hashOtp(otp);
  otpRecord.attempts = 0;
  otpRecord.expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);
  otpRecord.resendCount += 1;
  otpRecord.lastSentAt = now;
  await otpRecord.save();

  await sendOtpEmail({ email, name, otp, role });

  res.json({
    success: true,
    message: 'OTP resent to your email.',
    data: { retryAfterSeconds: OTP_RESEND_INTERVAL_SECONDS },
  });
});

const forgotPassword = asyncHandler(async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const requestedRole = String(req.body.role || '').trim().toLowerCase();

  if (!email) {
    throw new HttpError(400, 'Email is required.');
  }
  if (!isValidEmail(email)) {
    throw new HttpError(400, 'Invalid email format.');
  }

  const user = await User.findOne({ email });
  if (!user) {
    throw new HttpError(404, 'No account found with this email.');
  }

  const targetRole = requestedRole ? resolveRole(requestedRole) : null;
  if (targetRole && user.role !== targetRole) {
    throw new HttpError(404, 'Email is not registered for this portal.');
  }

  const roleForOtp = user.role;
  const otpRecord = await PasswordResetOtp.findOne({ email, role: roleForOtp });
  const otp = generateOtp();
  const otpHash = hashOtp(otp);
  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);
  const now = new Date();

  if (otpRecord && otpRecord.expiresAt.getTime() > Date.now()) {
    if (
      otpRecord.lastSentAt &&
      now.getTime() - otpRecord.lastSentAt.getTime() < OTP_RESEND_INTERVAL_SECONDS * 1000
    ) {
      const remaining = Math.ceil(
        (OTP_RESEND_INTERVAL_SECONDS * 1000 - (now.getTime() - otpRecord.lastSentAt.getTime())) /
          1000
      );
      throw new HttpError(429, `Please wait ${remaining} seconds before requesting a new OTP.`);
    }
    if (otpRecord.resendCount >= OTP_MAX_RESENDS) {
      throw new HttpError(429, 'OTP resend limit reached. Please try again later.');
    }
    otpRecord.otpHash = otpHash;
    otpRecord.attempts = 0;
    otpRecord.expiresAt = expiresAt;
    otpRecord.resendCount += 1;
    otpRecord.lastSentAt = now;
    await otpRecord.save();
  } else {
    await PasswordResetOtp.findOneAndUpdate(
      { email, role: roleForOtp },
      {
        otpHash,
        attempts: 0,
        resendCount: 0,
        lastSentAt: now,
        expiresAt,
      },
      { upsert: true, new: true }
    );
  }

  await sendPasswordResetOtpEmail({ email, name: user.name, otp });

  res.json({
    success: true,
    message: 'OTP sent to your email.',
    data: { retryAfterSeconds: OTP_RESEND_INTERVAL_SECONDS },
  });
});

const resetPassword = asyncHandler(async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const otp = String(req.body.otp || '').trim();
  const newPassword = String(req.body.password || '');
  const requestedRole = String(req.body.role || '').trim().toLowerCase();

  if (!email || !otp || !newPassword) {
    throw new HttpError(400, 'Email, OTP, and new password are required.');
  }
  if (!isValidEmail(email)) {
    throw new HttpError(400, 'Invalid email format.');
  }
  if (!isStrongPassword(newPassword)) {
    throw new HttpError(
      400,
      'Password must be at least 8 characters and include uppercase, lowercase, number, and special character.'
    );
  }

  const user = await User.findOne({ email });
  if (!user) {
    throw new HttpError(404, 'Email is not registered.');
  }

  const targetRole = requestedRole ? resolveRole(requestedRole) : null;
  if (targetRole && user.role !== targetRole) {
    throw new HttpError(404, 'Email is not registered for this portal.');
  }

  const roleForOtp = user.role;
  const otpRecord = await PasswordResetOtp.findOne({ email, role: roleForOtp });
  if (!otpRecord) {
    throw new HttpError(400, 'OTP expired or not found. Please request again.');
  }

  if (otpRecord.attempts >= OTP_MAX_ATTEMPTS) {
    await otpRecord.deleteOne();
    throw new HttpError(400, 'OTP attempts exceeded. Please request again.');
  }

  if (otpRecord.expiresAt.getTime() < Date.now()) {
    await otpRecord.deleteOne();
    throw new HttpError(400, 'OTP expired. Please request again.');
  }

  if (!isOtpValid(otp, otpRecord.otpHash)) {
    otpRecord.attempts += 1;
    await otpRecord.save();
    throw new HttpError(400, 'Invalid OTP. Please try again.');
  }

  user.password = newPassword;
  await user.save();
  await otpRecord.deleteOne();

  res.json({
    success: true,
    message: 'Password reset successful. Please login.',
  });
});

const verifyOtp = asyncHandler(async (req, res) => {
  const name = String(req.body.name || '').trim();
  const email = String(req.body.email || '').trim().toLowerCase();
  const phone = String(req.body.phone || '').trim();
  const password = String(req.body.password || '');
  const requestedRole = String(req.body.role || '').trim().toLowerCase();
  const otp = String(req.body.otp || '').trim();

  if (!name || !email || !phone || !password || !otp) {
    throw new HttpError(400, 'Please fill all required fields.');
  }

  if (!isValidEmail(email)) {
    throw new HttpError(400, 'Invalid email format.');
  }

  if (!isValidPhone(phone)) {
    throw new HttpError(400, 'Phone number must be 10 digits.');
  }

  if (!isStrongPassword(password)) {
    throw new HttpError(
      400,
      'Password must be at least 8 characters and include uppercase, lowercase, number, and special character.'
    );
  }

  const role = resolveRole(requestedRole);
  const otpRecord = await EmailOtp.findOne({ email, role });
  if (!otpRecord) {
    throw new HttpError(400, 'OTP expired or not found. Please register again.');
  }

  if (otpRecord.attempts >= OTP_MAX_ATTEMPTS) {
    await otpRecord.deleteOne();
    throw new HttpError(400, 'OTP attempts exceeded. Please register again.');
  }

  if (otpRecord.expiresAt.getTime() < Date.now()) {
    await otpRecord.deleteOne();
    throw new HttpError(400, 'OTP expired. Please register again.');
  }

  if (!isOtpValid(otp, otpRecord.otpHash)) {
    otpRecord.attempts += 1;
    await otpRecord.save();
    throw new HttpError(400, 'Invalid OTP. Please try again.');
  }

  const existing = await User.findOne({ email });
  if (existing) {
    await otpRecord.deleteOne();
    throw new HttpError(409, 'Email already registered.');
  }

  const user = new User({
    name,
    email,
    phone,
    password,
    role,
    blocked: false,
    joinDate: new Date(),
    lastLogin: null,
  });

  await user.save();
  await otpRecord.deleteOne();

  res.status(201).json({
    success: true,
    message: 'Registration successful.',
    data: {
      user: user.toSafeObject(),
    },
  });
});

const login = asyncHandler(async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  const portalRole = String(req.body.role || '').trim();

  if (!email || !password) {
    throw new HttpError(400, 'Please enter email and password.');
  }

  if (!isValidEmail(email)) {
    throw new HttpError(400, 'Please enter a valid email address.');
  }

  const user = await User.findOne({ email });
  if (!user) {
    throw new HttpError(401, 'Invalid email or password.');
  }

  const isPasswordValid = await user.comparePassword(password);
  if (!isPasswordValid) {
    throw new HttpError(401, 'Invalid email or password.');
  }

  if (user.blocked) {
    throw new HttpError(403, 'Your account has been blocked by admin.');
  }

  if (
    portalRole &&
    user.role !== USER_ROLES.ADMIN &&
    user.role.toLowerCase() !== portalRole.toLowerCase()
  ) {
    throw new HttpError(401, 'Invalid email or password.');
  }

  user.lastLogin = new Date();
  await user.save();

  const session = {
    userId: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    loginTime: new Date().toISOString(),
  };

  const token = signAccessToken({
    userId: user.id,
    role: user.role,
    email: user.email,
  });

  res.cookie(env.authCookieName, token, getAuthCookieOptions());

  res.json({
    success: true,
    message: 'Login successful.',
    data: {
      session,
      user: user.toSafeObject(),
    },
  });
});

const logout = asyncHandler(async (req, res) => {
  res.clearCookie(env.authCookieName, getAuthCookieOptions());
  res.json({
    success: true,
    message: 'Logout successful.',
    data: null,
  });
});

const me = asyncHandler(async (req, res) => {
  if (!req.user) {
    res.json({
      success: true,
      data: {
        session: null,
        user: null,
      },
    });
    return;
  }

  const session = {
    userId: req.user.id,
    name: req.user.name,
    email: req.user.email,
    phone: req.user.phone,
    role: req.user.role,
    loginTime: new Date().toISOString(),
  };

  res.json({
    success: true,
    data: {
      session,
      user: req.user.toSafeObject(),
    },
  });
});

module.exports = {
  register,
  resendOtp,
  verifyOtp,
  forgotPassword,
  resetPassword,
  login,
  logout,
  me,
};

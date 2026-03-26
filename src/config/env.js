const dotenv = require('dotenv');

dotenv.config();

function getRequiredEnv(name, options = {}) {
  const value = String(process.env[name] || '').trim();
  const disallowedValues = options.disallowedValues || [];

  if (!value) {
    throw new Error(`[Config] Missing required environment variable: ${name}`);
  }

  if (disallowedValues.includes(value)) {
    throw new Error(
      `[Config] Unsafe value for ${name}. Please set a strong secret/password in Backend/.env`
    );
  }

  return value;
}

function isStrongPassword(password) {
  return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/.test(password);
}

const seedAdminPassword = getRequiredEnv('DATA_SEED_ADMIN_PASSWORD', {
  disallowedValues: ['Admin@123'],
});

if (!isStrongPassword(seedAdminPassword)) {
  throw new Error(
    '[Config] DATA_SEED_ADMIN_PASSWORD must be strong (8+ chars with upper, lower, number, special).'
  );
}

const port = Number(getRequiredEnv('PORT'));
if (!Number.isFinite(port) || port <= 0) {
  throw new Error('[Config] PORT must be a valid number.');
}

const env = {
  port,
  nodeEnv: process.env.NODE_ENV,
  httpLogs: String(process.env.HTTP_LOGS || 'false').toLowerCase() === 'true',
  mongodbUri: getRequiredEnv('MONGODB_URI'),
  jwtSecret: getRequiredEnv('JWT_SECRET', {
    disallowedValues: ['change-this-in-production'],
  }),
  jwtExpiresIn: getRequiredEnv('JWT_EXPIRES_IN'),
  authCookieName: getRequiredEnv('AUTH_COOKIE_NAME'),
  clientOrigin: getRequiredEnv('CLIENT_ORIGIN'),
  razorpayKeyId: getRequiredEnv('RAZORPAY_KEY_ID'),
  razorpayKeySecret: getRequiredEnv('RAZORPAY_KEY_SECRET'),
  cloudinaryCloudName: getRequiredEnv('CLOUDINARY_CLOUD_NAME'),
  cloudinaryApiKey: getRequiredEnv('CLOUDINARY_API_KEY'),
  cloudinaryApiSecret: getRequiredEnv('CLOUDINARY_API_SECRET'),
  seedAdminEmail: process.env.DATA_SEED_ADMIN_EMAIL,
  seedAdminPassword,
};

module.exports = env;

const User = require('../models/user.model');
const env = require('../config/env');
const { USER_ROLES } = require('../constants/enums');
const { generateUserId } = require('../utils/id-generator');

async function seedDefaultAdmin() {
  const existingAdmin = await User.findOne({
    email: env.seedAdminEmail.toLowerCase().trim(),
  });

  if (existingAdmin) {
    const hashed = typeof existingAdmin.password === 'string' && existingAdmin.password.startsWith('$2');
    if (!hashed) {
      existingAdmin.password = env.seedAdminPassword;
      await existingAdmin.save();
      // eslint-disable-next-line no-console
      console.log('[Seed] Existing admin password upgraded to hashed format.');
    }
    return;
  }

  await User.create({
    id: generateUserId(),
    name: 'System Admin',
    email: env.seedAdminEmail.toLowerCase().trim(),
    phone: '9999999999',
    password: env.seedAdminPassword,
    role: USER_ROLES.ADMIN,
    blocked: false,
    joinDate: new Date(),
    lastLogin: null,
  });

  // eslint-disable-next-line no-console
  console.log(`[Seed] Default admin created: ${env.seedAdminEmail.toLowerCase().trim()}`);
}

module.exports = { seedDefaultAdmin };

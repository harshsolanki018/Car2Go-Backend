const mongoose = require('mongoose');
const env = require('./env');

async function connectDatabase() {
  mongoose.set('strictQuery', true);

  mongoose.connection.on('connected', () => {
    // eslint-disable-next-line no-console
    console.log(
      `[MongoDB] Connected to ${mongoose.connection.host}/${mongoose.connection.name}`
    );
  });

  mongoose.connection.on('error', (error) => {
    // eslint-disable-next-line no-console
    console.error('[MongoDB] Connection error:', error.message);
  });

  mongoose.connection.on('disconnected', () => {
    // eslint-disable-next-line no-console
    console.warn('[MongoDB] Disconnected');
  });

  await mongoose.connect(env.mongodbUri);
}

module.exports = { connectDatabase };

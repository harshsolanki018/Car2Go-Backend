const app = require('./app');
const env = require('./config/env');
const { connectDatabase } = require('./config/database');
const { seedDefaultAdmin } = require('./services/seed-admin.service');
const { reportDuplicateCarNumbers } = require('./services/data-integrity.service');
const {
  autoCompleteDueBookings,
  startBookingAutoCompleteScheduler,
} = require('./services/booking-auto-complete.service');

async function bootstrap() {
  await connectDatabase();
  await seedDefaultAdmin();
  await autoCompleteDueBookings();
  try {
    await reportDuplicateCarNumbers();
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn('[Startup][Integrity] Duplicate check failed:', error?.message || error);
  }
  const scheduler = startBookingAutoCompleteScheduler();

  const server = app.listen(env.port, () => {
    // eslint-disable-next-line no-console
    console.log(`Car2Go backend running on http://localhost:${env.port}`);
  });

  const shutdown = () => {
    scheduler.stop();
    server.close(() => process.exit(0));
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  server.on('error', (error) => {
    if (error && error.code === 'EADDRINUSE') {
      // eslint-disable-next-line no-console
      console.error(
        `[Startup] Port ${env.port} is already in use. Stop the existing process or change PORT in Backend/.env`
      );
      process.exit(1);
      return;
    }

    // eslint-disable-next-line no-console
    console.error('[Startup] Server failed to start:', error);
    process.exit(1);
  });
}

bootstrap().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('Failed to start server:', error);
  process.exit(1);
});

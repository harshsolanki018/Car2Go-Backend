const express = require('express');
const authRoutes = require('./auth.routes');
const carsRoutes = require('./cars.routes');
const bookingsRoutes = require('./bookings.routes');
const usersRoutes = require('./users.routes');
const messagesRoutes = require('./messages.routes');
const homeRoutes = require('./home.routes');
const statsRoutes = require('./stats.routes');
const adminRoutes = require('./admin.routes');
const ownerRoutes = require('./owner.routes');
const paymentsRoutes = require('./payments.routes');

const router = express.Router();

router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Backend is running',
    timestamp: new Date().toISOString(),
  });
});

router.use('/auth', authRoutes);
router.use('/cars', carsRoutes);
router.use('/bookings', bookingsRoutes);
router.use('/users', usersRoutes);
router.use('/messages', messagesRoutes);
router.use('/home', homeRoutes);
router.use('/stats', statsRoutes);
router.use('/admin', adminRoutes);
router.use('/owner', ownerRoutes);
router.use('/payments', paymentsRoutes);

module.exports = router;

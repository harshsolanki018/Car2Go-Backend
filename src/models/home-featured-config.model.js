const mongoose = require('mongoose');
const { getNextSequence } = require('./counter.model');

const homeFeaturedConfigSchema = new mongoose.Schema(
  {
    id: { type: Number, unique: true, index: true },
    key: { type: String, unique: true, default: 'home_featured_cars' },
    carIds: { type: [String], default: [] },
    updatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

homeFeaturedConfigSchema.pre('validate', async function ensureId(next) {
  if (!this.id) {
    this.id = await getNextSequence('home_featured_config_id');
  }
  next();
});

const HomeFeaturedConfig = mongoose.model(
  'HomeFeaturedConfig',
  homeFeaturedConfigSchema
);

module.exports = HomeFeaturedConfig;

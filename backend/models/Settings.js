const mongoose = require('mongoose');
const { AWS_REGION_CARBON_INTENSITY } = require('../utils/awsCarbonIntensity');

// Single-document collection: the deployment's editable classification
// thresholds, PUE and per-region grid carbon factors (Reports screen).
// Defaults mirror the approximate figures in utils/awsCarbonIntensity.js —
// a deployment can override any region with its own better data.
const SettingsSchema = new mongoose.Schema({
  _id: { type: String, default: 'global' },
  idleBelow: { type: Number, default: 10 },
  underutilizedBelow: { type: Number, default: 40 },
  overloadedAbove: { type: Number, default: 70 },
  pue: { type: Number, default: 1.2 },
  gridFactors: {
    type: Map,
    of: Number,
    default: AWS_REGION_CARBON_INTENSITY
  }
}, { minimize: false });

module.exports = mongoose.model('Settings', SettingsSchema);

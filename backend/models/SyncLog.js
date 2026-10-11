const mongoose = require('mongoose');

const SyncLogSchema = new mongoose.Schema({
  connectionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Connection' },
  source: { type: String, required: true },
  instances: { type: Number, default: 0 },
  durationMs: { type: Number, default: 0 },
  result: { type: String, enum: ['ok', 'partial', 'auth failed'], required: true }
}, { timestamps: true });

module.exports = mongoose.model('SyncLog', SyncLogSchema);

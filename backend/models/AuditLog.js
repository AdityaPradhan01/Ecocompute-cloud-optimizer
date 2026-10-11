const mongoose = require('mongoose');

const AuditLogSchema = new mongoose.Schema({
  text: { type: String, required: true }
}, { timestamps: true });

module.exports = mongoose.model('AuditLog', AuditLogSchema);

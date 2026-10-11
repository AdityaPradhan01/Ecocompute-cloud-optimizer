const mongoose = require('mongoose');

const ReportScheduleSchema = new mongoose.Schema({
  email: { type: String, required: true },
  period: { type: String, enum: ['month', 'quarter', 'year'], default: 'month' },
  lastSentAt: { type: Date }, // set after a real send succeeds — drives due-date checks in utils/reportDelivery.js
  lastSendError: { type: String } // last failure message, if any, surfaced on the Reports screen
}, { timestamps: true });

module.exports = mongoose.model('ReportSchedule', ReportScheduleSchema);

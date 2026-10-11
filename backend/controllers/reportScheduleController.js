const ReportSchedule = require('../models/ReportSchedule');
const { logAudit } = require('../utils/audit');
const { isConfigured } = require('../utils/mailer');

// Persists a real schedule preference. Actual delivery runs through
// backend/utils/reportDelivery.js, on a tick (see utils/scheduler.js) that
// checks it against the period's due date, and only if SMTP_* env vars are
// set on this deployment — otherwise the schedule honestly stays "saved"
// rather than claiming an email went out. See exports.sendNow to verify
// SMTP works right away instead of waiting for the due date.
exports.createSchedule = async (req, res) => {
  try {
    const { email, period } = req.body;
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'A valid email address is required.' });
    }
    const doc = await ReportSchedule.findOneAndUpdate(
      { email },
      { email, period: ['month', 'quarter', 'year'].includes(period) ? period : 'month' },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
    );
    await logAudit(`Monthly ESG report schedule saved for ${email} (${doc.period})`);
    res.json({ success: true, schedule: doc, smtpConfigured: isConfigured() });
  } catch (err) {
    console.error('Error saving report schedule:', err);
    res.status(500).json({ error: 'Failed to save the schedule.' });
  }
};

exports.listSchedules = async (req, res) => {
  try {
    const rows = await ReportSchedule.find().sort({ createdAt: -1 });
    res.json({ schedules: rows, smtpConfigured: isConfigured() });
  } catch (err) {
    console.error('Error listing report schedules:', err);
    res.status(500).json({ error: 'Failed to load schedules.' });
  }
};

// Sends one schedule's report immediately, bypassing the due-date check —
// this is how an admin verifies SMTP actually works without waiting for
// the 1st of the month.
exports.sendNow = async (req, res) => {
  if (!isConfigured()) {
    return res.status(400).json({ error: 'SMTP is not configured on this deployment — set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS and redeploy.' });
  }
  try {
    const { sendScheduleNow } = require('../utils/reportDelivery');
    const result = await sendScheduleNow(req.params.id);
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('Error sending report email:', err);
    res.status(500).json({ error: err.message || 'Failed to send the report email.' });
  }
};

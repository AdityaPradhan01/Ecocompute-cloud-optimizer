// Turns a saved ReportSchedule into a real email: pulls the same data the
// Reports/Optimize/Analytics screens show (via the controllers' exported
// builders, so the numbers can never drift from what's on screen), renders
// the PDF, and sends it over SMTP. Both the scheduler tick and the manual
// "send now" button go through sendScheduleNow — the only difference is
// who's asking.
const ReportSchedule = require('../models/ReportSchedule');
const { buildRecommendations } = require('../controllers/optimizeController');
const { buildAnalytics } = require('../controllers/analyticsController');
const { getSettingsSnapshot } = require('../controllers/settingsController');
const { getRecentAuditRows } = require('../controllers/auditController');
const CloudResource = require('../models/CloudResource');
const { buildReportPdfBuffer } = require('./reportPdfServer');
const { isConfigured, sendReportEmail } = require('./mailer');
const { logAudit } = require('./audit');

const PERIOD_LABEL = { month: 'This month', quarter: 'This quarter', year: 'Fiscal year' };

function periodSlug(period) {
  const d = new Date();
  if (period === 'year') return `fy${d.getFullYear()}`;
  if (period === 'quarter') return `q${Math.floor(d.getMonth() / 3) + 1}-${d.getFullYear()}`;
  return d.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }).replace(' ', '-').toLowerCase();
}

// A schedule is due once per calendar period, checked against lastSentAt —
// not a fixed N-days interval, so "monthly" always lands near the 1st
// regardless of when the schedule was originally created.
function isDue(schedule, now = new Date()) {
  if (!schedule.lastSentAt) return true;
  const last = schedule.lastSentAt;
  if (schedule.period === 'year') return last.getFullYear() < now.getFullYear();
  if (schedule.period === 'quarter') {
    const lastQ = last.getFullYear() * 4 + Math.floor(last.getMonth() / 3);
    const nowQ = now.getFullYear() * 4 + Math.floor(now.getMonth() / 3);
    return lastQ < nowQ;
  }
  return last.getFullYear() < now.getFullYear() || last.getMonth() < now.getMonth();
}

async function buildAndSend(schedule) {
  const resources = await CloudResource.find().sort({ costINR: -1 });
  const [recommendations, analytics, settings, auditRows] = await Promise.all([
    buildRecommendations(),
    buildAnalytics(),
    getSettingsSnapshot(),
    getRecentAuditRows(20)
  ]);

  const period = PERIOD_LABEL[schedule.period] || 'This month';
  const pdfBuffer = buildReportPdfBuffer({ period, resources, recommendations, analytics, settings, auditRows });
  const filename = `ecocompute-${periodSlug(schedule.period)}-report.pdf`;

  const html = `
    <p>Your ${period.toLowerCase()} EcoCompute sustainability report is attached.</p>
    <p>${resources.length} instance(s) tracked · ₹${Math.round(analytics.summary?.monthlySavings || 0).toLocaleString('en-IN')} in identified monthly savings · ${(Math.round((analytics.summary?.carbonSaved || 0) * 10) / 10).toLocaleString('en-IN')} kg CO₂ abatement capacity.</p>
    <p style="color:#6b6b66;font-size:12px;">Sent automatically by EcoCompute. Figures are computed from the active fleet snapshot at send time.</p>
  `;

  await sendReportEmail({
    to: schedule.email,
    subject: `EcoCompute — ${period} sustainability report`,
    html,
    attachment: { filename, buffer: pdfBuffer }
  });

  return filename;
}

// Called by one admin clicking "send now" on a specific schedule — bypasses
// the due-date check (that's the point: verify SMTP actually works without
// waiting for the 1st of the month) but still updates lastSentAt on success.
async function sendScheduleNow(scheduleId) {
  const schedule = await ReportSchedule.findById(scheduleId);
  if (!schedule) throw new Error('Schedule not found.');

  try {
    const filename = await buildAndSend(schedule);
    schedule.lastSentAt = new Date();
    schedule.lastSendError = undefined;
    await schedule.save();
    await logAudit(`Report emailed to ${schedule.email} (${filename})`);
    return { sent: true, filename };
  } catch (err) {
    schedule.lastSendError = err.message;
    await schedule.save();
    await logAudit(`Report email to ${schedule.email} failed — ${err.message}`);
    throw err;
  }
}

// Called on a tick by the scheduler (see backend/utils/scheduler.js). Only
// does anything if SMTP is actually configured — on a deployment without
// it, every schedule just stays "saved" forever, honestly, rather than
// retrying into a wall of errors every tick.
async function sendDueReports() {
  if (!isConfigured()) return;
  const schedules = await ReportSchedule.find();
  for (const schedule of schedules) {
    if (!isDue(schedule)) continue;
    try {
      await sendScheduleNow(schedule._id);
    } catch (err) {
      console.error(`Scheduled report send failed for ${schedule.email}:`, err.message);
    }
  }
}

module.exports = { isDue, sendScheduleNow, sendDueReports };

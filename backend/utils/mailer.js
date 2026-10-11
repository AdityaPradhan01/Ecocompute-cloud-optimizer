// SMTP email delivery for scheduled reports. Deliberately optional: a
// deployment with no SMTP_* env vars set can run the entire rest of the app
// (including scheduling a report, which just persists a preference) without
// this ever being touched. Only the actual send — the scheduled job or the
// "send now" button — needs it, and fails with a clear, honest error
// instead of silently pretending an email went out.
const nodemailer = require('nodemailer');

let cachedTransport = null;

function isConfigured() {
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

function getTransport() {
  if (!isConfigured()) {
    throw new Error('SMTP is not configured on this deployment — set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS (see backend/.env.example).');
  }
  if (!cachedTransport) {
    cachedTransport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT, 10) || 587,
      secure: process.env.SMTP_SECURE === 'true', // true for 465, false for 587/STARTTLS
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
    });
  }
  return cachedTransport;
}

async function sendReportEmail({ to, subject, html, attachment }) {
  const transport = getTransport();
  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  await transport.sendMail({
    from: `"EcoCompute Reports" <${from}>`,
    to,
    subject,
    html,
    attachments: attachment ? [{ filename: attachment.filename, content: attachment.buffer, contentType: 'application/pdf' }] : []
  });
}

module.exports = { isConfigured, sendReportEmail };

const Lead = require('../models/Lead');
const { logAudit } = require('../utils/audit');
const { isConfigured, sendReportEmail } = require('../utils/mailer');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Public, unauthenticated — the one write path besides login that doesn't
// require a token, so it's validated strictly and rate-limited (see
// middleware/rateLimiters.js). `website` is a honeypot: a real visitor
// never sees or fills that field (it's visually hidden on the form), so
// anything that does is almost certainly a bot — rejected with the same
// 201 response a real submission gets, so a scraping bot can't tell its
// submission was discarded and tune around it.
exports.createLead = async (req, res) => {
  try {
    const { name, workEmail, company, companySize, message, website } = req.body;

    if (website) {
      return res.status(201).json({ success: true });
    }

    if (!name || !String(name).trim() || !company || !String(company).trim()) {
      return res.status(400).json({ error: 'Name and company are required.' });
    }
    if (!workEmail || !EMAIL_RE.test(String(workEmail).trim())) {
      return res.status(400).json({ error: 'A valid work email is required.' });
    }

    const lead = await Lead.create({
      name: String(name).trim().slice(0, 200),
      workEmail: String(workEmail).trim().slice(0, 254),
      company: String(company).trim().slice(0, 200),
      companySize: companySize ? String(companySize).trim().slice(0, 50) : undefined,
      message: message ? String(message).trim().slice(0, 2000) : undefined
    });

    await logAudit(`New lead captured — ${lead.company} (${lead.workEmail})`);

    // Best-effort notification so a lead doesn't just silently sit in the
    // database until someone remembers to check the Leads screen. Never
    // blocks or fails the submission if SMTP isn't configured, or if the
    // operator hasn't set LEADS_NOTIFY_EMAIL.
    if (isConfigured() && process.env.LEADS_NOTIFY_EMAIL) {
      sendReportEmail({
        to: process.env.LEADS_NOTIFY_EMAIL,
        subject: `New EcoCompute lead — ${lead.company}`,
        html: `<p><strong>${lead.name}</strong> (${lead.workEmail}) at <strong>${lead.company}</strong>${lead.companySize ? ` (${lead.companySize})` : ''} requested a walkthrough.</p>${lead.message ? `<p>${lead.message}</p>` : ''}`
      }).catch((err) => console.error('Lead notification email failed:', err.message));
    }

    res.status(201).json({ success: true });
  } catch (err) {
    console.error('Error saving lead:', err);
    res.status(500).json({ error: 'Failed to submit — please try again.' });
  }
};

exports.listLeads = async (req, res) => {
  try {
    const rows = await Lead.find().sort({ createdAt: -1 });
    res.json(rows);
  } catch (err) {
    console.error('Error listing leads:', err);
    res.status(500).json({ error: 'Failed to load leads.' });
  }
};

exports.updateLeadStatus = async (req, res) => {
  try {
    const { status } = req.body;
    if (!['new', 'contacted', 'provisioned', 'closed'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status.' });
    }
    const lead = await Lead.findByIdAndUpdate(req.params.id, { status }, { returnDocument: 'after' });
    if (!lead) return res.status(404).json({ error: 'Lead not found.' });
    await logAudit(`Lead ${lead.company} marked ${status}`);
    res.json(lead);
  } catch (err) {
    console.error('Error updating lead:', err);
    res.status(500).json({ error: 'Failed to update lead.' });
  }
};

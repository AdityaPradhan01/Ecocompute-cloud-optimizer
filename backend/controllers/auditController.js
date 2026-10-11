const AuditLog = require('../models/AuditLog');

// Exported separately from the HTTP handler so the scheduled report-delivery
// job attaches the exact same recent audit rows the Reports screen shows.
async function getRecentAuditRows(limit = 20) {
  const rows = await AuditLog.find().sort({ createdAt: -1 }).limit(limit);
  return rows.map(r => ({
    time: new Date(r.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
    text: r.text
  }));
}

exports.getRecentAuditRows = getRecentAuditRows;

exports.getAuditLog = async (req, res) => {
  try {
    res.json(await getRecentAuditRows());
  } catch (err) {
    console.error('Error reading audit log:', err);
    res.status(500).json({ error: 'Failed to load the audit trail.' });
  }
};

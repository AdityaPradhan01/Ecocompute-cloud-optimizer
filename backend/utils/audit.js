const AuditLog = require('../models/AuditLog');

async function logAudit(text) {
  try {
    await AuditLog.create({ text });
  } catch (err) {
    console.error('Audit log write failed:', err);
  }
}

module.exports = { logAudit };

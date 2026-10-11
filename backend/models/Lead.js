const mongoose = require('mongoose');

// Captured from the public Landing page's "Book a walkthrough" form — the
// one unauthenticated write path in the app besides login. Deliberately
// minimal fields; this is a sales queue; the full onboarding runbook lives
// in docs/CUSTOMER_ONBOARDING.md, not in this schema.
const LeadSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 200 },
  workEmail: { type: String, required: true, trim: true, lowercase: true, maxlength: 254 },
  company: { type: String, required: true, trim: true, maxlength: 200 },
  companySize: { type: String, trim: true, maxlength: 50 },
  message: { type: String, trim: true, maxlength: 2000 },
  status: { type: String, enum: ['new', 'contacted', 'provisioned', 'closed'], default: 'new' }
}, { timestamps: true });

module.exports = mongoose.model('Lead', LeadSchema);

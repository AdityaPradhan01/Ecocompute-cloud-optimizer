// Public route — the "Book a walkthrough" form on the Landing page submits
// here with no auth token. Mounted in index.js alongside /api/auth, before
// the requireAuth gate that protects the rest of /api. Admin-side listing
// and status updates live in routes/api.js (behind requireAuth) instead.
const express = require('express');
const router = express.Router();
const leadsController = require('../controllers/leadsController');
const { leadLimiter } = require('../middleware/rateLimiters');

router.post('/', leadLimiter, leadsController.createLead);

module.exports = router;

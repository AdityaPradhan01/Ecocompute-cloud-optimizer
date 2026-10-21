const rateLimit = require('express-rate-limit');

// Local dev restarts constantly and drives much heavier request bursts than
// real usage (hot reload, Detection recomputing on every keystroke, a
// developer poking every screen back to back) — multiply every ceiling
// below by this outside production so those limits stay meaningful without
// tripping over normal local testing. Production keeps the real numbers.
const DEV_MULTIPLIER = process.env.NODE_ENV === 'production' ? 1 : 20;

// General ceiling for the whole API — generous enough for normal dashboard
// polling, tight enough to blunt scraping/abuse.
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300 * DEV_MULTIPLIER,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please slow down and try again shortly.' }
});

// Login is the one unauthenticated route that can be brute-forced — keep it
// tight regardless of what the general limiter allows.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10 * DEV_MULTIPLIER,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { error: 'Too many login attempts. Please wait before trying again.' }
});

// Connection tests accept user-supplied cloud credentials and make outbound
// calls to AWS — worth limiting independently of general API traffic.
// 60, not 20: live troubleshooting a role ARN/external ID in front of an
// audience means several retries in quick succession — the limit should
// never be what fails, only actual abuse.
const connectionTestLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60 * DEV_MULTIPLIER,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many connection test attempts. Please wait before trying again.' }
});

// The public lead-capture form (Landing page) is the one other
// unauthenticated write path — worth its own tight limit independent of
// the general API ceiling, same reasoning as login.
const leadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5 * DEV_MULTIPLIER,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many submissions. Please try again later.' }
});

// CSV upload does real disk + DB I/O (write temp file, parse, replace the
// whole fleet snapshot) — worth its own ceiling independent of the general
// API limit, same reasoning as connection tests. 60, not 20, for the same
// live-retry reason.
const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60 * DEV_MULTIPLIER,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many upload attempts. Please wait before trying again.' }
});

module.exports = { apiLimiter, loginLimiter, connectionTestLimiter, leadLimiter, uploadLimiter };

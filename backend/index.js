require('dotenv').config();

// Fail fast on missing secrets instead of silently falling back to an
// insecure default (the old behavior for CONN_SECRET) — a misconfigured
// deployment should refuse to start, not run unprotected.
const REQUIRED_ENV = ['MONGO_URI', 'JWT_SECRET', 'ENCRYPTION_KEY', 'ADMIN_USERNAME', 'ADMIN_PASSWORD_HASH'];
const missing = REQUIRED_ENV.filter((key) => !process.env[key]);
if (missing.length) {
  console.error(`Missing required environment variable(s): ${missing.join(', ')}. See backend/.env.example.`);
  process.exit(1);
}
if (Buffer.from(process.env.ENCRYPTION_KEY, 'base64').length !== 32) {
  console.error('ENCRYPTION_KEY must be a base64-encoded 32-byte value. Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'base64\'))"');
  process.exit(1);
}
// A short/weak JWT_SECRET would still "work" — nothing else would notice
// until someone brute-forces session tokens. Catch it at boot instead.
if (process.env.JWT_SECRET.length < 32) {
  console.error('JWT_SECRET is too short (must be 32+ characters). Generate one with: node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"');
  process.exit(1);
}
// A plaintext password pasted into ADMIN_PASSWORD_HASH by mistake doesn't
// fail here — it fails on every single login attempt afterward, as a
// generic 500 (bcrypt.compare throws on a non-bcrypt-hash second argument),
// which is a much worse place to discover a typo than right now at boot.
if (!/^\$2[aby]\$\d{2}\$/.test(process.env.ADMIN_PASSWORD_HASH)) {
  console.error('ADMIN_PASSWORD_HASH does not look like a bcrypt hash — did you paste the plaintext password by mistake? Generate one with: node -e "console.log(require(\'bcryptjs\').hashSync(\'your-password\', 10))"');
  process.exit(1);
}

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const apiRoutes = require('./routes/api');
const authRoutes = require('./routes/auth');
const leadsRoutes = require('./routes/leads');
const requireAuth = require('./middleware/requireAuth');
const { apiLimiter } = require('./middleware/rateLimiters');
const { notFound, errorHandler } = require('./middleware/errorHandler');
const sanitizeBody = require('./middleware/sanitizeBody');
const { loadSettingsOnBoot } = require('./controllers/settingsController');
const { startScheduler } = require('./utils/scheduler');

const app = express();
app.set('trust proxy', 1); // required for correct client IPs / rate limiting behind Render's proxy

app.use(helmet());
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:3000')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error('Not allowed by CORS'));
  }
}));

app.use(express.json({ limit: '1mb' }));
app.use(sanitizeBody);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected' });
});

app.use('/api/auth', authRoutes);
app.use('/api/leads', leadsRoutes);
app.use('/api', apiLimiter, requireAuth, apiRoutes);

app.use(notFound);
app.use(errorHandler);

// The HTTP server only starts listening once Mongo is actually connected —
// previously app.listen() ran unconditionally and immediately, so the API
// would accept and attempt to serve requests during the connection window
// (or forever, on a bad MONGO_URI) with every DB-backed route failing.
// Same "fail fast on misconfiguration" philosophy as the env var checks
// above, applied to the one dependency that isn't an env var typo.
const PORT = process.env.PORT || 5000;

mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('MongoDB successfully connected.');
    return loadSettingsOnBoot();
  })
  .then(() => startScheduler())
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Eco-Compute Server running securely on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Database connection error — refusing to start:', err);
    process.exit(1);
  });

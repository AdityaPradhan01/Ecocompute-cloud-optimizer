const bcrypt = require('bcryptjs');
const { signToken } = require('../utils/jwt');
const { logAudit } = require('../utils/audit');

// Single-admin login — credentials live in env (ADMIN_USERNAME / ADMIN_PASSWORD_HASH),
// never in the database. See backend/.env.example for how to generate the hash.
exports.login = async (req, res) => {
  try {
    const { username, password } = req.body;
    // Explicit typeof check, not just truthiness — `{}` is truthy in JS,
    // so a non-string body (e.g. a NoSQL-operator injection attempt like
    // `{"username": {"$ne": null}}`, which sanitizeBody reduces to `{}`)
    // would otherwise sail past `!username` and reach bcrypt.compare()
    // with an object, which throws and surfaces as a generic 500 instead
    // of a clean 400. Caught by the app's own smoke test.
    if (typeof username !== 'string' || typeof password !== 'string' || !username || !password) {
      return res.status(400).json({ error: 'Username and password are required.' });
    }

    const validUsername = username === process.env.ADMIN_USERNAME;
    // Always run bcrypt.compare, even on a username mismatch, against the
    // configured hash so response timing doesn't reveal whether the
    // username was correct.
    const passwordMatches = await bcrypt.compare(password, process.env.ADMIN_PASSWORD_HASH);

    if (!validUsername || !passwordMatches) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    const token = signToken({ sub: username, role: 'admin' });
    await logAudit(`Admin login — ${username}`);
    res.json({ success: true, token, username });
  } catch (err) {
    console.error('Error during login:', err);
    res.status(500).json({ error: 'Login failed.' });
  }
};

exports.me = (req, res) => {
  res.json({ username: req.user.sub, role: req.user.role });
};

// Generates every secret a new customer's dedicated deployment needs, in
// one shot, instead of running three separate `node -e` commands by hand
// (error-prone once you've done it a dozen times). Prints a ready-to-paste
// block for Render's environment variable dashboard. Nothing here is
// stored or sent anywhere — it only prints to your terminal.
//
// Usage: node scripts/new-customer-secrets.js <admin-password> [admin-username]
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

const password = process.argv[2];
const username = process.argv[3] || 'admin';

if (!password) {
  console.error('Usage: node scripts/new-customer-secrets.js <admin-password> [admin-username]');
  console.error('Example: node scripts/new-customer-secrets.js "Tr0ub4dor&3" acmecorp-admin');
  process.exit(1);
}
if (password.length < 10) {
  console.error('Pick a longer admin password (10+ chars) — this is the one login for the entire customer deployment.');
  process.exit(1);
}

const adminPasswordHash = bcrypt.hashSync(password, 10);
const jwtSecret = crypto.randomBytes(48).toString('hex');
const encryptionKey = crypto.randomBytes(32).toString('base64');

console.log('\n--- Paste these into the new customer\'s backend service on Render (sync:false vars) ---\n');
console.log(`ADMIN_USERNAME=${username}`);
console.log(`ADMIN_PASSWORD_HASH=${adminPasswordHash}`);
console.log(`JWT_SECRET=${jwtSecret}`);
console.log(`ENCRYPTION_KEY=${encryptionKey}`);
console.log('\n--- Give the customer, out of band (not email in plaintext) ---\n');
console.log(`Username: ${username}`);
console.log(`Password: ${password}`);
console.log('\nSee docs/CUSTOMER_ONBOARDING.md for the full checklist (Atlas cluster, Render services, CORS, smoke test).\n');

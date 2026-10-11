const mongoose = require('mongoose');

// Credentials are stored encrypted (AES-256-GCM, see backend/utils/crypto.js)
// so the app can actually present them to AWS's SDK when polling — not
// just prove a value was once entered. 'key' mode encrypts a static access
// key pair; 'role' mode encrypts the role ARN plus a server-generated
// externalId (confused-deputy mitigation for cross-account AssumeRole).
const ConnectionSchema = new mongoose.Schema({
  provider: { type: String, required: true, enum: ['aws', 'azure', 'gcp', 'prom', 'ssh'] },
  authMode: { type: String, enum: ['role', 'key'], default: 'role' },

  encAccessKeyId: { type: String }, // 'key' mode only
  encSecretAccessKey: { type: String }, // 'key' mode only
  encRoleArn: { type: String }, // 'role' mode only
  encExternalId: { type: String }, // 'role' mode only, generated server-side

  credentialPreview: { type: String }, // last 4 chars of the access key or role ARN, for the UI to confirm "yes, saved"
  zones: { type: [String], default: [] }, // AWS region codes this connection polls (e.g. ap-south-1)
  pollIntervalMinutes: { type: Number, default: 5, min: 1, max: 60 },
  status: { type: String, enum: ['Live', 'Needs auth', 'Not connected'], default: 'Not connected' },
  lastTestPassed: { type: Boolean, default: false },
  lastSyncAt: { type: Date },
  instancesDiscovered: { type: Number, default: 0 }
}, { timestamps: true });

module.exports = mongoose.model('Connection', ConnectionSchema);

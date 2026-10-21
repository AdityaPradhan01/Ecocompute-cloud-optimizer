// Turns a stored Connection document back into real AWS SDK credentials.
// 'key' mode decrypts a static access key pair and uses it directly.
// 'role' mode uses *this server's own* AWS identity (AWS_ACCESS_KEY_ID /
// AWS_SECRET_ACCESS_KEY env vars, or its IAM role if deployed on AWS) to
// call sts:AssumeRole into the customer's role ARN, scoped with the
// per-connection externalId generated at save time (confused-deputy
// mitigation) — this is why 'role' mode needs the server itself to have a
// base AWS identity, documented in backend/.env.example.
const { STSClient, AssumeRoleCommand } = require('@aws-sdk/client-sts');
const { decrypt } = require('./crypto');

async function resolveCredentials(connection) {
  if (connection.authMode === 'key') {
    return {
      accessKeyId: decrypt(connection.encAccessKeyId),
      secretAccessKey: decrypt(connection.encSecretAccessKey)
    };
  }

  // role mode
  const roleArn = decrypt(connection.encRoleArn);
  const externalId = decrypt(connection.encExternalId);
  const sts = new STSClient({}); // picks up the server's own base credentials from the environment
  const result = await sts.send(new AssumeRoleCommand({
    RoleArn: roleArn,
    ExternalId: externalId,
    RoleSessionName: 'ecocompute-poll',
    // 3600 (1 hour) — AWS's own default max session duration for a role
    // with no explicit MaxSessionDuration override, so this is always
    // valid. 900 left a large account's sync at risk of the session
    // expiring mid-pagination/mid-CloudWatch-fan-out.
    DurationSeconds: 3600
  }));
  return {
    accessKeyId: result.Credentials.AccessKeyId,
    secretAccessKey: result.Credentials.SecretAccessKey,
    sessionToken: result.Credentials.SessionToken
  };
}

module.exports = { resolveCredentials };

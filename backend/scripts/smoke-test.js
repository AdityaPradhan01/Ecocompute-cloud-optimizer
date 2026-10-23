// Boots the real backend (backend/index.js, unmodified) against a real,
// throwaway in-memory MongoDB and exercises every route end to end: auth
// rejection/acceptance, the full data pipeline (seed -> dashboard -> optimize
// -> analytics -> settings -> audit -> connections -> detection), and the
// report-schedule/send-now path including its "SMTP not configured" guard.
//
// This is not a substitute for a full unit-test suite — it's a fast,
// realistic "does the whole thing actually work" gate, meant to run before
// every deploy (and in CI on every push). No real secrets are used: every
// credential below is generated fresh, in memory, for this run only.
//
// Usage: npm run smoke-test   (from backend/)
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

async function main() {
  const { MongoMemoryServer } = require('mongodb-memory-server');

  const testPassword = crypto.randomBytes(12).toString('hex');
  process.env.NODE_ENV = process.env.NODE_ENV || 'development';
  process.env.PORT = String(5000 + Math.floor(Math.random() * 5000));
  process.env.CORS_ORIGINS = 'http://localhost:3000';
  process.env.ADMIN_USERNAME = 'smoketest-admin';
  process.env.ADMIN_PASSWORD_HASH = bcrypt.hashSync(testPassword, 10);
  process.env.JWT_SECRET = crypto.randomBytes(48).toString('hex');
  process.env.JWT_EXPIRES_IN = '12h';
  process.env.ENCRYPTION_KEY = crypto.randomBytes(32).toString('base64');

  const mongod = await MongoMemoryServer.create();
  process.env.MONGO_URI = mongod.getUri('ecocompute_smoketest');

  require('../index.js');

  const base = `http://localhost:${process.env.PORT}`;

  // index.js only calls app.listen() after Mongo connects, settings load,
  // and the scheduler starts — a chain whose total time varies with runner
  // load (a cold mongodb-memory-server download on a busy CI box can blow
  // well past a fixed sleep). Poll /api/health instead of guessing a delay,
  // so this only waits as long as boot actually takes.
  const bootDeadline = Date.now() + 30_000;
  for (;;) {
    try {
      const res = await fetch(`${base}/api/health`);
      if (res.ok) break;
    } catch { /* server not accepting connections yet */ }
    if (Date.now() > bootDeadline) throw new Error('Server did not become ready within 30s of boot.');
    await new Promise((r) => setTimeout(r, 250));
  }
  const results = [];
  const record = async (label, fn) => {
    try { results.push([label, 'OK', JSON.stringify(await fn()).slice(0, 160)]); }
    catch (e) { results.push([label, 'FAIL', e.message]); }
  };
  const expectStatus = async (expected, fn) => {
    try { await fn(); throw new Error(`expected ${expected}, got success`); }
    catch (e) { if (e.message.startsWith(String(expected))) return 'correctly rejected'; throw e; }
  };
  const fetchJson = async (url, opts = {}) => {
    const res = await fetch(url, opts);
    const text = await res.text();
    let body; try { body = JSON.parse(text); } catch { body = text; }
    if (!res.ok) throw new Error(`${res.status} ${JSON.stringify(body)}`);
    return body;
  };

  let token, scheduleId;

  await record('GET /api/health', () => fetchJson(`${base}/api/health`));
  await record('login rejects wrong password', () => expectStatus(401, () =>
    fetchJson(`${base}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'smoketest-admin', password: 'wrong' }) })));
  await record('login rejects NoSQL-operator injection attempt cleanly (400)', () => expectStatus(400, () =>
    // { $ne: null } would match "anything not null" if this ever reached a raw Mongo
    // query unsanitized. sanitizeBody reduces it to {} before the controller sees it;
    // the controller then must reject a non-string username/password with a clean 400
    // rather than let it reach bcrypt.compare() (which throws on a non-string input).
    fetchJson(`${base}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: { $ne: null }, password: { $ne: null } }) })));
  await record('login accepts correct password', async () => {
    const r = await fetchJson(`${base}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'smoketest-admin', password: testPassword }) });
    token = r.token;
    return { gotToken: !!token };
  });
  await record('unauthenticated API access rejected', () => expectStatus(401, () => fetchJson(`${base}/api/dashboard/summary`)));

  const auth = { Authorization: `Bearer ${token}` };
  const authJson = { ...auth, 'Content-Type': 'application/json' };

  await record('GET /api/auth/me', () => fetchJson(`${base}/api/auth/me`, { headers: auth }));
  await record('POST /api/seed-demo', () => fetchJson(`${base}/api/seed-demo`, { method: 'POST', headers: auth }));
  await record('GET /api/dashboard/summary', () => fetchJson(`${base}/api/dashboard/summary`, { headers: auth }));
  await record('GET /api/dashboard/resources', () => fetchJson(`${base}/api/dashboard/resources`, { headers: auth }));
  await record('GET /api/optimize', () => fetchJson(`${base}/api/optimize`, { headers: auth }));
  await record('POST /api/optimize/apply', () => fetchJson(`${base}/api/optimize/apply`, { method: 'POST', headers: auth }));
  await record('GET /api/analytics', () => fetchJson(`${base}/api/analytics`, { headers: auth }));
  await record('GET /api/settings', () => fetchJson(`${base}/api/settings`, { headers: auth }));
  await record('PUT /api/settings', () => fetchJson(`${base}/api/settings`, { method: 'PUT', headers: authJson, body: JSON.stringify({ pue: 1.25 }) }));
  await record('GET /api/audit-log', () => fetchJson(`${base}/api/audit-log`, { headers: auth }));
  await record('GET /api/connections', () => fetchJson(`${base}/api/connections`, { headers: auth }));
  await record('POST /api/connections/generate-external-id', () => fetchJson(`${base}/api/connections/generate-external-id`, { method: 'POST', headers: auth }));
  await record('GET /api/connections/sync-log', () => fetchJson(`${base}/api/connections/sync-log`, { headers: auth }));
  await record('POST /api/detection/calculate', () => fetchJson(`${base}/api/detection/calculate`, { method: 'POST', headers: authJson, body: JSON.stringify({ tdp: 165, utilization: 45, region: 'ap-south-1', hourlyRate: 9.4 }) }));

  await record('POST /api/reports/schedule', async () => {
    const r = await fetchJson(`${base}/api/reports/schedule`, { method: 'POST', headers: authJson, body: JSON.stringify({ email: 'smoketest@example.com', period: 'month' }) });
    scheduleId = r.schedule._id;
    return r;
  });
  await record('GET /api/reports/schedule', () => fetchJson(`${base}/api/reports/schedule`, { headers: auth }));
  await record('send-now without SMTP fails honestly (400)', () => expectStatus(400, () =>
    fetchJson(`${base}/api/reports/schedule/${scheduleId}/send-now`, { method: 'POST', headers: auth })));

  let leadId;
  await record('POST /api/leads (public, no auth)', async () => {
    const r = await fetchJson(`${base}/api/leads`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Smoke Tester', workEmail: 'smoke@example.com', company: 'Smoke Test Co' }) });
    return r;
  });
  await record('POST /api/leads rejects missing email (400)', () => expectStatus(400, () =>
    fetchJson(`${base}/api/leads`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'No Email', company: 'Acme' }) })));
  await record('POST /api/leads honeypot silently accepted, not stored', async () => {
    const before = (await fetchJson(`${base}/api/leads`, { headers: auth })).length;
    await fetchJson(`${base}/api/leads`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Bot', workEmail: 'bot@example.com', company: 'Bot Co', website: 'http://spam.example' }) });
    const after = (await fetchJson(`${base}/api/leads`, { headers: auth })).length;
    if (after !== before) throw new Error(`expected honeypot submission to be discarded, but lead count went ${before} -> ${after}`);
    return 'honeypot correctly discarded';
  });
  await record('GET /api/leads requires auth', () => expectStatus(401, () => fetchJson(`${base}/api/leads`)));
  await record('GET /api/leads (admin)', async () => {
    const rows = await fetchJson(`${base}/api/leads`, { headers: auth });
    leadId = rows[0]._id;
    return { count: rows.length };
  });
  await record('PATCH /api/leads/:id', () => fetchJson(`${base}/api/leads/${leadId}`, { method: 'PATCH', headers: authJson, body: JSON.stringify({ status: 'contacted' }) }));

  await record('sanitizeBody middleware strips $-operator and dotted keys', () => {
    // Direct unit check, not a round-trip through a controller — every
    // existing controller already defensively String()-coerces or
    // allowlist-checks its fields, which would mask whether this
    // middleware is actually doing anything. This isolates it.
    const sanitizeBody = require('../middleware/sanitizeBody');
    const req = { body: { email: 'a@b.com', filter: { $where: 'this.password', 'a.b': 1, nested: { $gt: 5, safe: 'ok' } } } };
    let called = false;
    sanitizeBody(req, {}, () => { called = true; });
    if (!called) throw new Error('middleware did not call next()');
    const json = JSON.stringify(req.body);
    if (json.includes('$where') || json.includes('$gt') || json.includes('a.b')) {
      throw new Error(`operator/dotted key survived: ${json}`);
    }
    if (req.body.filter.nested.safe !== 'ok') throw new Error('sanitizer over-stripped a safe sibling key');
    return 'operator and dotted keys removed, safe keys preserved';
  });

  console.log('\n=== SMOKE TEST RESULTS ===');
  let anyFail = false;
  for (const [label, status, detail] of results) {
    if (status === 'FAIL') anyFail = true;
    console.log(`${status === 'OK' ? 'PASS' : 'FAIL'} - ${label}${status === 'FAIL' ? ' :: ' + detail : ''}`);
  }
  console.log(anyFail ? '\nSOME CHECKS FAILED' : `\nALL ${results.length} CHECKS PASSED`);

  await mongod.stop();
  process.exit(anyFail ? 1 : 0);
}

main().catch((e) => { console.error('Smoke test crashed:', e); process.exit(1); });

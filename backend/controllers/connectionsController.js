const crypto = require('crypto');
const { STSClient, GetCallerIdentityCommand, AssumeRoleCommand } = require('@aws-sdk/client-sts');
const { EC2Client, DescribeInstancesCommand } = require('@aws-sdk/client-ec2');
const { CloudWatchClient, GetMetricStatisticsCommand } = require('@aws-sdk/client-cloudwatch');

const Connection = require('../models/Connection');
const SyncLog = require('../models/SyncLog');
const CloudResource = require('../models/CloudResource');
const carbonMath = require('../utils/carbonMath');
const { logAudit } = require('../utils/audit');
const { encrypt } = require('../utils/crypto');
const { resolveCredentials } = require('../utils/awsCredentials');
const { AWS_REGIONS, isAwsRegion } = require('../utils/awsRegions');
const { estimateHourlyRateINR, estimateTdpWatts } = require('../utils/awsPricing');

const PROVIDER_KIND = {
  aws: 'Metrics API · real EC2 + CloudWatch',
  azure: 'Service principal · coming soon',
  gcp: 'Service account · coming soon',
  prom: 'node_exporter scrape · coming soon',
  ssh: 'sar / proc sampling · coming soon'
};
const PROVIDER_NAME = {
  aws: 'AWS CloudWatch',
  azure: 'Azure Monitor',
  gcp: 'Google Cloud Monitoring',
  prom: 'Prometheus',
  ssh: 'SSH agentless'
};
// Only AWS is wired up to a real cloud API today. The others stay visible
// in the UI as "coming soon" rather than being silently simulated.
const IMPLEMENTED_PROVIDERS = ['aws'];

const AWS_ROLE_ARN_RE = /^arn:aws:iam::\d{12}:role\/[\w+=,.@-]+$/;
const AWS_ACCESS_KEY_ID_RE = /^AKIA[0-9A-Z]{16}$/;

async function buildCard(provider) {
  const doc = await Connection.findOne({ provider });
  const instanceCount = doc ? await CloudResource.countDocuments({ sourceConnectionId: doc._id }) : 0;
  const implemented = IMPLEMENTED_PROVIDERS.includes(provider);

  let status = implemented ? 'Not connected' : 'Coming soon';
  let cta = implemented ? 'Connect' : 'Coming soon';
  if (doc && implemented) {
    status = doc.status;
    cta = status === 'Live' ? 'Sync now' : (status === 'Needs auth' ? 'Add key' : 'Connect');
  }

  return {
    provider,
    name: PROVIDER_NAME[provider],
    kind: PROVIDER_KIND[provider],
    implemented,
    status,
    scope: doc ? doc.zones.map((z) => carbonMath.zoneLabel(z)).join(', ') || '—' : '—',
    instances: instanceCount,
    sync: doc && doc.lastSyncAt ? new Date(doc.lastSyncAt).toLocaleString('en-IN') : 'never',
    cta
  };
}

exports.getConnections = async (req, res) => {
  try {
    const cards = await Promise.all(Object.keys(PROVIDER_NAME).map(buildCard));

    const csvCount = await CloudResource.countDocuments({ sourceConnectionId: null });
    const lastCsv = await CloudResource.findOne({ sourceConnectionId: null }).sort({ uploadedAt: -1 });
    cards.push({
      provider: 'csv',
      name: 'CSV snapshot',
      kind: 'Manual upload · always available',
      implemented: true,
      status: csvCount > 0 ? 'Live' : 'Available',
      scope: csvCount > 0 ? `last upload ${csvCount} rows` : '—',
      instances: csvCount,
      sync: lastCsv ? new Date(lastCsv.uploadedAt).toLocaleDateString('en-IN') : 'never',
      cta: 'Upload'
    });

    const liveDocs = await Connection.find({ status: 'Live' });
    const totalDiscovered = liveDocs.reduce((a, d) => a + (d.instancesDiscovered || 0), 0) + csvCount;
    const lastPoll = liveDocs.length
      ? liveDocs.reduce((latest, d) => (d.lastSyncAt && (!latest || d.lastSyncAt > latest) ? d.lastSyncAt : latest), null)
      : null;

    res.json({
      sources: cards,
      liveSources: liveDocs.length,
      discovered: totalDiscovered,
      lastPoll: lastPoll ? new Date(lastPoll).toLocaleString('en-IN') : 'never',
      awsRegions: AWS_REGIONS,
      providers: Object.keys(PROVIDER_NAME).map((id) => ({ id, name: PROVIDER_NAME[id], implemented: IMPLEMENTED_PROVIDERS.includes(id) }))
    });
  } catch (err) {
    console.error('Error listing connections:', err);
    res.status(500).json({ error: 'Failed to load connections.' });
  }
};

// Generates a fresh, unsaved external ID for a role-mode connection. Shown
// to the user once, so they can put it in their IAM role's trust policy
// *before* testing — AssumeRole will reject the test until that trust
// policy's sts:ExternalId condition matches this value.
exports.generateExternalId = (req, res) => {
  res.json({ externalId: crypto.randomBytes(16).toString('hex') });
};

async function buildAwsCredentials({ authMode, roleArn, externalId, accessKeyId, secretAccessKey, region }) {
  if (authMode === 'key') {
    return { accessKeyId, secretAccessKey };
  }
  const sts = new STSClient({});
  const assumed = await sts.send(new AssumeRoleCommand({
    RoleArn: roleArn,
    ExternalId: externalId,
    RoleSessionName: 'ecocompute-test',
    DurationSeconds: 900
  }));
  return {
    accessKeyId: assumed.Credentials.AccessKeyId,
    secretAccessKey: assumed.Credentials.SecretAccessKey,
    sessionToken: assumed.Credentials.SessionToken
  };
}

exports.testConnection = async (req, res) => {
  try {
    const { provider, authMode, roleArn, externalId, accessKeyId, secretAccessKey, zones } = req.body;
    const steps = [];

    if (!IMPLEMENTED_PROVIDERS.includes(provider)) {
      return res.json({
        passed: false,
        steps: [{ mark: '01', text: `${PROVIDER_NAME[provider] || provider} integration is not implemented yet — coming soon.`, ok: false }],
        instancesDiscovered: 0
      });
    }

    steps.push({ mark: '01', text: 'Checking credential format …', ok: true });

    let formatOk = false;
    if (authMode === 'role') {
      formatOk = AWS_ROLE_ARN_RE.test(String(roleArn || '').trim()) && !!externalId;
    } else if (authMode === 'key') {
      formatOk = AWS_ACCESS_KEY_ID_RE.test(String(accessKeyId || '').trim()) && String(secretAccessKey || '').length >= 20;
    }
    if (!formatOk) {
      steps.push({ mark: '02', text: 'Credential format check failed.', ok: false });
      return res.json({ passed: false, steps, instancesDiscovered: 0 });
    }
    steps.push({ mark: '02', text: 'Credential format check passed.', ok: true });

    const selectedZones = Array.isArray(zones) ? zones.filter((z) => isAwsRegion(z)) : [];
    if (!selectedZones.length) {
      steps.push({ mark: '03', text: 'Select at least one AWS region to poll.', ok: false });
      return res.json({ passed: false, steps, instancesDiscovered: 0 });
    }

    try {
      const creds = await buildAwsCredentials({ authMode, roleArn, externalId, accessKeyId, secretAccessKey });

      const stsCheck = new STSClient({ credentials: creds, region: selectedZones[0] });
      const identity = await stsCheck.send(new GetCallerIdentityCommand({}));
      steps.push({ mark: '03', text: `Authenticated as ${identity.Arn}`, ok: true });

      let totalInstances = 0;
      for (const region of selectedZones) {
        const ec2 = new EC2Client({ credentials: creds, region });
        const result = await ec2.send(new DescribeInstancesCommand({}));
        totalInstances += (result.Reservations || []).reduce((a, r) => a + (r.Instances || []).length, 0);
      }
      steps.push({ mark: '04', text: `Discovered ${totalInstances} EC2 instance(s) across ${selectedZones.length} region(s)`, ok: true });
      steps.push({ mark: '05', text: 'Connection healthy. Scope used: ec2:DescribeInstances, sts:GetCallerIdentity (read-only).', ok: true });

      res.json({ passed: true, steps, instancesDiscovered: totalInstances });
    } catch (awsErr) {
      console.error('AWS connection test failed:', awsErr);
      steps.push({ mark: '!', text: `AWS rejected the request: ${awsErr.message || 'unknown error'}`, ok: false });
      res.json({ passed: false, steps, instancesDiscovered: 0 });
    }
  } catch (err) {
    console.error('Error testing connection:', err);
    res.status(500).json({ error: 'Connection test failed to run.' });
  }
};

exports.saveConnection = async (req, res) => {
  try {
    const { provider, authMode, roleArn, externalId, accessKeyId, secretAccessKey, zones, pollIntervalMinutes } = req.body;

    if (!IMPLEMENTED_PROVIDERS.includes(provider)) {
      return res.status(400).json({ error: `${PROVIDER_NAME[provider] || provider} is not implemented yet.` });
    }

    const selectedZones = Array.isArray(zones) ? zones.filter((z) => isAwsRegion(z)) : [];
    if (!selectedZones.length) {
      return res.status(400).json({ error: 'Select at least one AWS region.' });
    }

    const setFields = {
      provider,
      authMode: authMode === 'key' ? 'key' : 'role',
      zones: selectedZones,
      pollIntervalMinutes: Math.max(1, Math.min(60, parseInt(pollIntervalMinutes, 10) || 5)),
      status: 'Needs auth',
      lastTestPassed: true
    };
    let unsetFields;

    if (authMode === 'key') {
      if (!AWS_ACCESS_KEY_ID_RE.test(String(accessKeyId || '').trim()) || String(secretAccessKey || '').length < 20) {
        return res.status(400).json({ error: 'Credential failed validation — run a test connection first.' });
      }
      setFields.encAccessKeyId = encrypt(accessKeyId);
      setFields.encSecretAccessKey = encrypt(secretAccessKey);
      setFields.credentialPreview = String(accessKeyId).slice(-4);
      unsetFields = { encRoleArn: '', encExternalId: '' };
    } else {
      if (!AWS_ROLE_ARN_RE.test(String(roleArn || '').trim()) || !externalId) {
        return res.status(400).json({ error: 'Credential failed validation — run a test connection first.' });
      }
      setFields.encRoleArn = encrypt(roleArn);
      setFields.encExternalId = encrypt(externalId);
      setFields.credentialPreview = String(roleArn).slice(-4);
      unsetFields = { encAccessKeyId: '', encSecretAccessKey: '' };
    }

    const doc = await Connection.findOneAndUpdate(
      { provider },
      { $set: setFields, $unset: unsetFields },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
    );

    await logAudit(`Connection saved — ${PROVIDER_NAME[provider]}, polling ${selectedZones.map((z) => carbonMath.zoneLabel(z)).join(', ')}`);

    const safeDoc = doc.toObject();
    delete safeDoc.encAccessKeyId;
    delete safeDoc.encSecretAccessKey;
    delete safeDoc.encRoleArn;
    delete safeDoc.encExternalId;
    res.json({ success: true, connection: safeDoc });
  } catch (err) {
    console.error('Error saving connection:', err);
    res.status(500).json({ error: 'Failed to save connection.' });
  }
};

async function fetchRecentCpuAverage(cw, instanceId) {
  try {
    const end = new Date();
    const start = new Date(end.getTime() - 60 * 60 * 1000);
    const metrics = await cw.send(new GetMetricStatisticsCommand({
      Namespace: 'AWS/EC2',
      MetricName: 'CPUUtilization',
      Dimensions: [{ Name: 'InstanceId', Value: instanceId }],
      StartTime: start,
      EndTime: end,
      Period: 3600,
      Statistics: ['Average']
    }));
    return metrics.Datapoints && metrics.Datapoints[0] ? metrics.Datapoints[0].Average : 0;
  } catch (err) {
    console.warn(`CloudWatch metric fetch failed for ${instanceId}:`, err.message);
    return 0;
  }
}

async function runSync(doc) {
  const start = Date.now();
  if (!doc.lastTestPassed || !doc.zones.length) {
    await SyncLog.create({ connectionId: doc._id, source: PROVIDER_NAME[doc.provider], instances: 0, durationMs: 0, result: 'auth failed' });
    doc.status = 'Needs auth';
    await doc.save();
    return { result: 'auth failed', instances: 0 };
  }

  try {
    const creds = await resolveCredentials(doc);
    const instances = [];

    for (const region of doc.zones) {
      const ec2 = new EC2Client({ credentials: creds, region });
      const cw = new CloudWatchClient({ credentials: creds, region });

      const described = await ec2.send(new DescribeInstancesCommand({
        Filters: [{ Name: 'instance-state-name', Values: ['running', 'stopped'] }]
      }));

      for (const reservation of described.Reservations || []) {
        for (const inst of reservation.Instances || []) {
          const nameTag = (inst.Tags || []).find((t) => t.Key === 'Name');
          const envTag = (inst.Tags || []).find((t) => /^env(ironment)?$/i.test(t.Key));
          const isRunning = inst.State && inst.State.Name === 'running';
          const cpu = isRunning ? await fetchRecentCpuAverage(cw, inst.InstanceId) : 0;

          const tdp = estimateTdpWatts(inst.InstanceType);
          const rate = estimateHourlyRateINR(inst.InstanceType, region);
          const environment = envTag ? envTag.Value.toLowerCase() : 'production';

          const energy = carbonMath.calculateEnergy(tdp, cpu);
          const carbon = carbonMath.calculateCarbon(energy, region);
          const cost = carbonMath.calculateCost(rate);
          const classification = carbonMath.getClassification(cpu);

          instances.push({
            serverName: nameTag ? nameTag.Value : inst.InstanceId,
            instanceType: inst.InstanceType,
            awsInstanceId: inst.InstanceId,
            tdp,
            tdpSource: 'estimated',
            cpuUtilization: parseFloat(cpu.toFixed(1)),
            pue: 1.2,
            region,
            hourlyRate: parseFloat(rate.toFixed(2)),
            pricingSource: 'aws-ondemand-list-price-approx',
            environment,
            energyKWh: parseFloat(energy.toFixed(3)),
            carbonKg: parseFloat(carbon.toFixed(3)),
            costINR: parseFloat(cost.toFixed(2)),
            classification,
            isOptimized: false,
            sourceConnectionId: doc._id
          });
        }
      }
    }

    await CloudResource.deleteMany({ sourceConnectionId: doc._id });
    if (instances.length) await CloudResource.insertMany(instances);

    doc.status = 'Live';
    doc.lastSyncAt = new Date();
    doc.instancesDiscovered = instances.length;
    await doc.save();

    const durationMs = Date.now() - start;
    await SyncLog.create({ connectionId: doc._id, source: PROVIDER_NAME[doc.provider], instances: instances.length, durationMs, result: 'ok' });
    return { result: 'ok', instances: instances.length };
  } catch (err) {
    console.error('AWS sync failed:', err);
    await SyncLog.create({ connectionId: doc._id, source: PROVIDER_NAME[doc.provider], instances: 0, durationMs: Date.now() - start, result: 'auth failed' });
    doc.status = 'Needs auth';
    await doc.save();
    return { result: 'auth failed', instances: 0 };
  }
}

exports.syncOne = async (req, res) => {
  try {
    const doc = await Connection.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Connection not found.' });
    const result = await runSync(doc);
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('Error syncing connection:', err);
    res.status(500).json({ error: 'Sync failed.' });
  }
};

exports.syncAll = async (req, res) => {
  try {
    const docs = await Connection.find({ lastTestPassed: true });
    const results = [];
    for (const doc of docs) {
      results.push({ provider: doc.provider, ...(await runSync(doc)) });
    }
    await logAudit(`Synced ${docs.length} live source(s) on demand`);
    res.json({ success: true, results });
  } catch (err) {
    console.error('Error syncing all connections:', err);
    res.status(500).json({ error: 'Sync all failed.' });
  }
};

// Connection ids currently mid-sync — guards against the scheduler firing a
// second poll for the same connection while a slow one (many regions/many
// instances) is still running.
const pollsInFlight = new Set();

// Called on a fixed tick by the scheduler (see backend/utils/scheduler.js).
// Each connection sets its own cadence via pollIntervalMinutes; this just
// checks whether that much time has passed since lastSyncAt and, if so,
// runs the same sync logic a manual "Sync now" click would.
exports.pollDueConnections = async () => {
  const docs = await Connection.find({ lastTestPassed: true });
  const now = Date.now();

  for (const doc of docs) {
    const id = String(doc._id);
    if (pollsInFlight.has(id)) continue;

    const dueAt = doc.lastSyncAt
      ? doc.lastSyncAt.getTime() + doc.pollIntervalMinutes * 60 * 1000
      : 0; // never synced — due immediately
    if (now < dueAt) continue;

    pollsInFlight.add(id);
    try {
      await runSync(doc);
    } catch (err) {
      console.error(`Scheduled poll failed for connection ${id}:`, err);
    } finally {
      pollsInFlight.delete(id);
    }
  }
};

exports.getSyncLog = async (req, res) => {
  try {
    const rows = await SyncLog.find().sort({ createdAt: -1 }).limit(20);
    res.json(rows.map((r) => ({
      time: new Date(r.createdAt).toLocaleTimeString('en-IN', { hour12: false }),
      source: r.source,
      instances: r.instances,
      ms: r.durationMs ? `${r.durationMs} ms` : '—',
      result: r.result
    })));
  } catch (err) {
    console.error('Error reading sync log:', err);
    res.status(500).json({ error: 'Failed to load the sync log.' });
  }
};

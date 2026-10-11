// Drives automatic polling for live connections. The Connections UI lets
// you set a per-connection poll interval, but nothing previously acted on
// it — a sync only ever happened when someone clicked a button. This ticks
// frequently enough (every 30s) that each connection's own interval
// (1-60 minutes) is honored reasonably promptly.
const TICK_MS = 30 * 1000;

// Scheduled report emails are only ever due once a day at most (monthly/
// quarterly/yearly cadence) — checking every 30s like the AWS poller would
// just be wasted work, so this runs on its own, much slower tick.
const REPORT_TICK_MS = 6 * 60 * 60 * 1000; // every 6 hours

let connectionTimer = null;
let reportTimer = null;

function startScheduler() {
  if (connectionTimer) return; // already running
  const { pollDueConnections } = require('../controllers/connectionsController');
  const { sendDueReports } = require('./reportDelivery');

  connectionTimer = setInterval(() => {
    pollDueConnections().catch((err) => console.error('Scheduler tick failed:', err));
  }, TICK_MS);

  reportTimer = setInterval(() => {
    sendDueReports().catch((err) => console.error('Report delivery tick failed:', err));
  }, REPORT_TICK_MS);
  sendDueReports().catch((err) => console.error('Report delivery tick failed:', err)); // also check once at boot

  console.log(`Connection poll scheduler started (checking every ${TICK_MS / 1000}s).`);
  console.log(`Report delivery scheduler started (checking every ${REPORT_TICK_MS / 1000 / 60 / 60}h).`);
}

function stopScheduler() {
  if (connectionTimer) clearInterval(connectionTimer);
  if (reportTimer) clearInterval(reportTimer);
  connectionTimer = null;
  reportTimer = null;
}

module.exports = { startScheduler, stopScheduler };

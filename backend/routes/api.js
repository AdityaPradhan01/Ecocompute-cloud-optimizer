const express = require('express');
const router = express.Router();
const multer = require('multer');

// Only CSVs, capped at 5MB, rejected up front by mimetype+extension rather
// than accepting anything and sorting it out later in the parser.
const upload = multer({
  dest: 'uploads/',
  limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 5 },
  fileFilter: (req, file, cb) => {
    const okMime = ['text/csv', 'application/vnd.ms-excel', 'application/octet-stream'].includes(file.mimetype);
    const okExt = file.originalname.toLowerCase().endsWith('.csv');
    if (okMime && okExt) return cb(null, true);
    cb(new Error('Only .csv files are accepted.'));
  }
});

const dashboardController = require('../controllers/dashboardController');
const detectionController = require('../controllers/detectionController');
const optimizeController = require('../controllers/optimizeController');
const analyticsController = require('../controllers/analyticsController');
const csvController = require('../controllers/csvController');
const settingsController = require('../controllers/settingsController');
const connectionsController = require('../controllers/connectionsController');
const auditController = require('../controllers/auditController');
const reportScheduleController = require('../controllers/reportScheduleController');
const leadsController = require('../controllers/leadsController');
const { connectionTestLimiter, uploadLimiter } = require('../middleware/rateLimiters');

// --- CORE SYSTEM ROUTE MAPPINGS ---
router.get('/dashboard/summary', dashboardController.getDashboardSummary);
router.get('/dashboard/resources', dashboardController.listResources);

router.post('/seed-demo', dashboardController.seedDemoDataset);

router.post('/detection/calculate', detectionController.calculateLiveMetrics);

router.get('/optimize', optimizeController.getRecommendations);
router.post('/optimize/apply', optimizeController.applyOptimization);
router.post('/optimize/apply-aws/:resourceId', optimizeController.applyAwsShutdown);

router.get('/analytics', analyticsController.getAnalyticsTrends);
router.post('/upload', uploadLimiter, upload.single('file'), (err, req, res, next) => {
  if (err) return res.status(400).json({ success: false, message: err.message });
  next();
}, csvController.uploadCSV);
router.delete('/fleet', csvController.clearFleet);

// --- SETTINGS (classification thresholds, PUE, per-zone grid factors) ---
router.get('/settings', settingsController.getSettings);
router.put('/settings', settingsController.updateSettings);

// --- AUDIT TRAIL ---
router.get('/audit-log', auditController.getAuditLog);

// --- LEADS (public submission is in routes/leads.js; this is the admin side) ---
router.get('/leads', leadsController.listLeads);
router.patch('/leads/:id', leadsController.updateLeadStatus);

// --- REPORT SCHEDULING (persists preference; delivery needs SMTP config) ---
router.post('/reports/schedule', reportScheduleController.createSchedule);
router.get('/reports/schedule', reportScheduleController.listSchedules);
router.post('/reports/schedule/:id/send-now', reportScheduleController.sendNow);

// --- CONNECTIONS SUBSYSTEM ---
router.get('/connections', connectionsController.getConnections);
router.post('/connections/generate-external-id', connectionsController.generateExternalId);
router.post('/connections/test', connectionTestLimiter, connectionsController.testConnection);
router.post('/connections', connectionsController.saveConnection);
router.post('/connections/:id/sync', connectionsController.syncOne);
router.post('/connections/sync-all', connectionsController.syncAll);
router.get('/connections/sync-log', connectionsController.getSyncLog);

module.exports = router;

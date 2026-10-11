const Settings = require('../models/Settings');
const carbonMath = require('../utils/carbonMath');
const { AWS_REGION_BY_ID, AWS_REGIONS } = require('../utils/awsRegions');
const { logAudit } = require('../utils/audit');

async function getOrCreateSettings() {
  let doc = await Settings.findById('global');
  if (!doc) {
    doc = await Settings.create({ _id: 'global' });
    return doc;
  }
  // One-time self-heal: a doc persisted before the region model switched to
  // real AWS regions still holds the old fictional Mumbai-zone keys. Reset
  // it to the new defaults rather than silently computing against stale data.
  const hasRealRegion = Array.from(doc.gridFactors.keys()).some((k) => AWS_REGION_BY_ID[k]);
  if (doc.gridFactors.size > 0 && !hasRealRegion) {
    doc.gridFactors = new Map(Object.entries(require('../utils/awsCarbonIntensity').AWS_REGION_CARBON_INTENSITY));
    await doc.save();
  }
  return doc;
}

// Called once at server boot so the in-memory carbonMath cache reflects
// whatever was last persisted (grid factors / thresholds / PUE survive a restart).
exports.loadSettingsOnBoot = async () => {
  try {
    const doc = await getOrCreateSettings();
    carbonMath.setThresholds({
      idleBelow: doc.idleBelow,
      underutilizedBelow: doc.underutilizedBelow,
      overloadedAbove: doc.overloadedAbove
    });
    carbonMath.setPUE(doc.pue);
    carbonMath.setGridFactors(Object.fromEntries(doc.gridFactors));
    console.log('Settings loaded from database and applied to the arithmetic engine.');
  } catch (err) {
    console.error('Failed to load settings on boot — using built-in defaults:', err);
  }
};

// Exported separately from the HTTP handler so the scheduled report-delivery
// job reads the exact same settings snapshot the Reports screen shows.
async function getSettingsSnapshot() {
  const doc = await getOrCreateSettings();
  return {
    idleBelow: doc.idleBelow,
    underutilizedBelow: doc.underutilizedBelow,
    overloadedAbove: doc.overloadedAbove,
    pue: doc.pue,
    gridFactors: Object.fromEntries(doc.gridFactors),
    awsRegions: AWS_REGIONS
  };
}

exports.getSettingsSnapshot = getSettingsSnapshot;

exports.getSettings = async (req, res) => {
  try {
    res.json(await getSettingsSnapshot());
  } catch (err) {
    console.error('Error reading settings:', err);
    res.status(500).json({ error: 'Failed to load settings.' });
  }
};

exports.updateSettings = async (req, res) => {
  try {
    const { idleBelow, underutilizedBelow, overloadedAbove, pue, gridFactors } = req.body;
    const doc = await getOrCreateSettings();
    const changes = [];

    if (gridFactors && typeof gridFactors === 'object') {
      for (const [zone, value] of Object.entries(gridFactors)) {
        const num = parseFloat(value);
        if (!AWS_REGION_BY_ID[zone] || isNaN(num) || num <= 0) continue;
        const before = doc.gridFactors.get(zone);
        if (before !== num) {
          changes.push(`Grid factor for ${carbonMath.zoneLabel(zone)} edited ${before} → ${num} gCO₂/kWh`);
          doc.gridFactors.set(zone, num);
        }
      }
    }
    if (idleBelow !== undefined && !isNaN(parseFloat(idleBelow))) doc.idleBelow = parseFloat(idleBelow);
    if (underutilizedBelow !== undefined && !isNaN(parseFloat(underutilizedBelow))) doc.underutilizedBelow = parseFloat(underutilizedBelow);
    if (overloadedAbove !== undefined && !isNaN(parseFloat(overloadedAbove))) doc.overloadedAbove = parseFloat(overloadedAbove);
    if (pue !== undefined && !isNaN(parseFloat(pue))) doc.pue = parseFloat(pue);

    await doc.save();

    carbonMath.setThresholds({ idleBelow: doc.idleBelow, underutilizedBelow: doc.underutilizedBelow, overloadedAbove: doc.overloadedAbove });
    carbonMath.setPUE(doc.pue);
    carbonMath.setGridFactors(Object.fromEntries(doc.gridFactors));

    for (const c of changes) await logAudit(c);
    if (changes.length === 0) await logAudit('Classification thresholds and PUE reviewed — no values changed');

    res.json({
      success: true,
      idleBelow: doc.idleBelow,
      underutilizedBelow: doc.underutilizedBelow,
      overloadedAbove: doc.overloadedAbove,
      pue: doc.pue,
      gridFactors: Object.fromEntries(doc.gridFactors)
    });
  } catch (err) {
    console.error('Error updating settings:', err);
    res.status(500).json({ error: 'Failed to update settings.' });
  }
};

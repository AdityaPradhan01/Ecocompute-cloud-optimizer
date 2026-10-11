// Domain arithmetic — single source of truth for energy, carbon and cost math.
//
// Region model: real AWS region codes only (ap-south-1, us-east-1, ...),
// with approximate country-level grid carbon intensity per region (see
// backend/utils/awsCarbonIntensity.js for sourcing notes). This is the one
// region system the whole app uses — CSV uploads, the demo dataset, and
// live AWS connections all reference the same real regions, so "migrate to
// a lower-carbon region" means something real instead of comparing
// invented numbers.

const { AWS_REGION_CARBON_INTENSITY, FALLBACK_AWS_FACTOR } = require('./awsCarbonIntensity');
const { AWS_REGION_BY_ID } = require('./awsRegions');

// Mutated in place (never reassigned) so every module that destructured this
// object at require-time keeps seeing live edits made through /api/settings.
// Defaults to the approximate figures in awsCarbonIntensity.js; a deployment
// can override any region's number with its own better data via Settings.
const GRID_FACTORS = { ...AWS_REGION_CARBON_INTENSITY };

const THRESHOLDS = {
  idleBelow: 10,
  underutilizedBelow: 40,
  overloadedAbove: 70
};

const RUNTIME = { pue: 1.2 };

// Used only when a row's region string doesn't match any known region.
const FALLBACK_FACTOR = FALLBACK_AWS_FACTOR;

const MONTHLY_OPERATIONAL_HOURS = 730;

function replaceKeys(target, next) {
  Object.keys(target).forEach((k) => delete target[k]);
  Object.assign(target, next);
}

function setGridFactors(next) {
  replaceKeys(GRID_FACTORS, next);
}

function setThresholds(next) {
  Object.assign(THRESHOLDS, next);
}

function setPUE(value) {
  const v = parseFloat(value);
  if (!isNaN(v) && v > 0) RUNTIME.pue = v;
}

function getSettingsSnapshot() {
  return {
    gridFactors: { ...GRID_FACTORS },
    thresholds: { ...THRESHOLDS },
    pue: RUNTIME.pue
  };
}

function getLowestFactorZone() {
  return Object.entries(GRID_FACTORS).reduce((lowest, entry) => (entry[1] < lowest[1] ? entry : lowest))[0];
}

function getHighestFactorZone() {
  return Object.entries(GRID_FACTORS).reduce((highest, entry) => (entry[1] > highest[1] ? entry : highest))[0];
}

function zoneLabel(id) {
  const key = String(id).toLowerCase().trim();
  return (AWS_REGION_BY_ID[key] && AWS_REGION_BY_ID[key].label) || id;
}

function calculateEnergy(tdp, cpuUtilization) {
  return (tdp * MONTHLY_OPERATIONAL_HOURS * (cpuUtilization / 100)) / 1000;
}

function gridFactorFor(region) {
  const normRegion = String(region).toLowerCase().trim();
  return normRegion in GRID_FACTORS ? GRID_FACTORS[normRegion] : null;
}

function calculateCarbon(energyKWh, region) {
  const intensity = gridFactorFor(region);
  if (intensity === null) {
    console.warn(`Unknown region "${region}" — defaulting to the global average (${FALLBACK_FACTOR} gCO2/kWh).`);
  }
  return (energyKWh * RUNTIME.pue * (intensity ?? FALLBACK_FACTOR)) / 1000;
}

function carbonAtZone(energyKWh, zoneId) {
  const intensity = gridFactorFor(zoneId) ?? FALLBACK_FACTOR;
  return (energyKWh * RUNTIME.pue * intensity) / 1000;
}

function isKnownRegion(region) {
  return gridFactorFor(region) !== null;
}

function calculateCost(hourlyRate) {
  return parseFloat(hourlyRate) * MONTHLY_OPERATIONAL_HOURS;
}

function getClassification(cpuUtilization) {
  const usage = parseFloat(cpuUtilization);
  if (usage < THRESHOLDS.idleBelow) return 'Idle';
  if (usage < THRESHOLDS.underutilizedBelow) return 'Underutilized';
  if (usage <= THRESHOLDS.overloadedAbove) return 'Optimal';
  return 'Overloaded';
}

// Single Source of Truth for Optimization Rules across all views
function generateOptimizationRules(node) {
  const classification = getClassification(node.cpuUtilization);
  let recommendation = 'Maintain Status Quo';
  let savingsPercent = 0;

  const region = String(node.region).toLowerCase().trim();
  const lowestZone = getLowestFactorZone();

  if (classification === 'Idle') {
    recommendation = 'Shutdown Server';
    savingsPercent = 1.0;
  } else if (classification === 'Underutilized') {
    recommendation = 'Rightsize Instance';
    savingsPercent = 0.4;
  } else if (node.environment === 'dev' || node.environment === 'test') {
    recommendation = 'Auto Shutdown Schedule (Off-Hours)';
    savingsPercent = 0.5;
  } else if (region !== lowestZone && node.cpuUtilization > 50) {
    recommendation = `Migrate to Lower-Carbon Region (${zoneLabel(lowestZone)})`;
    savingsPercent = 0.0;
  }

  return { recommendation, savingsPercent };
}

module.exports = {
  calculateEnergy,
  calculateCarbon,
  carbonAtZone,
  calculateCost,
  getClassification,
  generateOptimizationRules,
  isKnownRegion,
  getLowestFactorZone,
  getHighestFactorZone,
  gridFactorFor,
  zoneLabel,
  setGridFactors,
  setThresholds,
  setPUE,
  getSettingsSnapshot,
  GRID_FACTORS,
  THRESHOLDS,
  RUNTIME
};

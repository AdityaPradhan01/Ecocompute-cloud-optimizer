const { 
  calculateEnergy, 
  calculateCarbon, 
  calculateCost, 
  getClassification,
  isKnownRegion
} = require('../utils/carbonMath');

exports.calculateLiveMetrics = (req, res) => {
  try {
    const { tdp, utilization, region, hourlyRate } = req.body;

    // Convert string inputs to floating numeric points safely
    const numTdp = parseFloat(tdp) || 0;
    const numCpu = parseFloat(utilization) || 0;
    const numRate = parseFloat(hourlyRate) || 0;
    const targetRegion = region || 'ap-south-1';

    // Reject nonsensical inputs instead of silently computing garbage numbers
    if (numTdp <= 0) {
      return res.status(400).json({ error: "TDP must be a positive number (watts)." });
    }
    if (numCpu < 0 || numCpu > 100) {
      return res.status(400).json({ error: "CPU utilization must be between 0 and 100." });
    }
    if (numRate < 0) {
      return res.status(400).json({ error: "Hourly rate cannot be negative." });
    }

    const regionWarning = !isKnownRegion(targetRegion)
      ? `Unrecognized region "${targetRegion}" — used the global average carbon intensity instead.`
      : undefined;

    // Apply strict structural formulas
    const energyKWh = calculateEnergy(numTdp, numCpu);
    const carbonKg = calculateCarbon(energyKWh, targetRegion);
    const costINR = calculateCost(numRate);
    const classification = getClassification(numCpu);

    res.json({
      energyKWh: parseFloat(energyKWh.toFixed(3)),
      carbonKg: parseFloat(carbonKg.toFixed(3)),
      costINR: parseFloat(costINR.toFixed(2)),
      classification,
      ...(regionWarning && { warning: regionWarning })
    });
  } catch (error) {
    console.error("Error running validation pipeline rules:", error);
    res.status(500).json({ error: "Telemetry calculation runtime failure." });
  }
};
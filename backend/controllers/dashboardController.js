const CloudResource = require('../models/CloudResource');
const {
  calculateEnergy,
  calculateCarbon,
  calculateCost,
  getClassification
} = require('../utils/carbonMath');
const { logAudit } = require('../utils/audit');

exports.getDashboardSummary = async (req, res) => {
  try {
    const resources = await CloudResource.find();

    let totalEnergy = 0;
    let totalCarbon = 0;
    let totalCost = 0;
    let idleCount = 0;
    let totalCpu = 0;

    resources.forEach(node => {
      totalEnergy += node.energyKWh || 0;
      totalCarbon += node.carbonKg || 0;
      totalCost += node.costINR || 0;
      totalCpu += node.cpuUtilization || 0;
      if (getClassification(node.cpuUtilization) === 'Idle') idleCount++;
    });

    const avgCpu = resources.length > 0 ? totalCpu / resources.length : 0;

    res.json({
      serversScanned: resources.length,
      idleDetected: idleCount,
      totalEnergyKWh: parseFloat(totalEnergy.toFixed(2)),
      totalCarbonKg: parseFloat(totalCarbon.toFixed(2)),
      totalCostINR: parseFloat(totalCost.toFixed(2)),
      liveCpu: parseFloat(avgCpu.toFixed(1))
    });
  } catch (error) {
    console.error("Dashboard metrics aggregation crash:", error);
    res.status(500).json({ error: "Internal server monitoring error." });
  }
};

exports.listResources = async (req, res) => {
  try {
    const resources = await CloudResource.find().sort({ costINR: -1 });
    // classification is recomputed live (not the stored snapshot from
    // ingest time) so this list can't disagree with the idle count on
    // /api/dashboard/summary, or with Optimize's recommendations, the
    // moment someone edits thresholds in Settings.
    const withLiveClassification = resources.map((r) => {
      const obj = r.toObject();
      obj.classification = getClassification(r.cpuUtilization);
      return obj;
    });
    res.json(withLiveClassification);
  } catch (error) {
    console.error("Error listing fleet resources:", error);
    res.status(500).json({ error: "Failed to load the fleet register." });
  }
};

exports.seedDemoDataset = async (req, res) => {
  try {
    // Twelve-instance sample fleet spread across real AWS regions, so the
    // carbon numbers (and the "migrate to a lower-carbon region"
    // recommendation) reflect real, meaningfully different grid intensities
    // instead of one fictional city. Server names/specs are illustrative
    // sample values, not tied to any real account.
    const demoNodes = [
      { serverName: "prod-api-01", instanceType: "t3.medium", tdp: 165, cpuUtilization: 62, region: "ap-south-1", hourlyRate: 9.4, environment: "production" },
      { serverName: "prod-api-02", instanceType: "t3.medium", tdp: 165, cpuUtilization: 58, region: "ap-south-1", hourlyRate: 9.4, environment: "production" },
      { serverName: "batch-etl-03", instanceType: "r5.xlarge", tdp: 205, cpuUtilization: 84, region: "us-east-1", hourlyRate: 12.6, environment: "production" },
      { serverName: "ml-train-01", instanceType: "c5.2xlarge", tdp: 280, cpuUtilization: 91, region: "eu-west-1", hourlyRate: 18.2, environment: "production" },
      { serverName: "cache-redis-01", instanceType: "r5.large", tdp: 95, cpuUtilization: 44, region: "ap-south-1", hourlyRate: 5.1, environment: "production" },
      { serverName: "stage-web-01", instanceType: "t3.large", tdp: 120, cpuUtilization: 27, region: "eu-north-1", hourlyRate: 6.8, environment: "test" },
      { serverName: "stage-web-02", instanceType: "t3.large", tdp: 120, cpuUtilization: 22, region: "eu-north-1", hourlyRate: 6.8, environment: "test" },
      { serverName: "dev-sandbox-04", instanceType: "t3.medium", tdp: 110, cpuUtilization: 31, region: "eu-north-1", hourlyRate: 4.5, environment: "dev" },
      { serverName: "dev-sandbox-05", instanceType: "t3.medium", tdp: 110, cpuUtilization: 6, region: "us-east-1", hourlyRate: 4.5, environment: "dev" },
      { serverName: "legacy-report-01", instanceType: "m5.large", tdp: 140, cpuUtilization: 4, region: "ap-south-1", hourlyRate: 7.2, environment: "production" },
      { serverName: "qa-runner-02", instanceType: "t3.medium", tdp: 95, cpuUtilization: 12, region: "eu-west-1", hourlyRate: 4.9, environment: "test" },
      { serverName: "archive-01", instanceType: "t3.large", tdp: 150, cpuUtilization: 38, region: "us-west-2", hourlyRate: 11.0, environment: "production" }
    ];

    const structuredDemo = demoNodes.map(node => {
      const energy = calculateEnergy(node.tdp, node.cpuUtilization);
      const carbon = calculateCarbon(energy, node.region);
      const cost = calculateCost(node.hourlyRate);
      const classification = getClassification(node.cpuUtilization);

      return {
        ...node,
        pue: 1.2,
        energyKWh: parseFloat(energy.toFixed(3)),
        carbonKg: parseFloat(carbon.toFixed(3)),
        costINR: parseFloat(cost.toFixed(2)),
        classification,
        isOptimized: false
      };
    });

    await CloudResource.deleteMany({});
    const inserted = await CloudResource.insertMany(structuredDemo);
    await logAudit(`Fleet snapshot replaced with the sample demo fleet (${inserted.length} instances across ${new Set(structuredDemo.map(n => n.region)).size} AWS regions)`);

    res.json({
      success: true,
      message: `Demo asset infrastructure dataset seeded successfully! Loaded ${inserted.length} nodes.`,
      count: inserted.length
    });
  } catch (err) {
    console.error("Seeding operation failed:", err);
    res.status(500).json({ success: false, message: "Demo seed procedure failed internally." });
  }
};

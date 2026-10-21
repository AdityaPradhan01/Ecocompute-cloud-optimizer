const CloudResource = require('../models/CloudResource');
const { generateOptimizationRules, carbonAtZone, getLowestFactorZone, zoneLabel, gridFactorFor, getClassification } = require('../utils/carbonMath');

// Exported separately from the HTTP handler so the scheduled report-delivery
// job computes the exact same analytics the live Analytics screen shows.
async function buildAnalytics() {
    const resources = await CloudResource.find();

    if (!resources || resources.length === 0) {
      return {
        success: true,
        top5Highest: [], top5Lowest: [], costTrend: [], carbonTrend: [], regionData: [],
        aiInsights: ["No active cluster deployments mapped. Please run infrastructure seed module on Data intake."],
        summary: { monthlySavings: "0.00", annualSavings: "0.00", carbonSaved: "0.00" }
      };
    }

    const sortedByEnergyDesc = [...resources].sort((a, b) => (b.energyKWh || 0) - (a.energyKWh || 0));
    const top5Consumers = sortedByEnergyDesc.slice(0, 5).map(r => ({ name: r.serverName, value: r.energyKWh }));
    const lowest5Consumers = [...sortedByEnergyDesc].reverse().slice(0, 5).map(r => ({ name: r.serverName, value: r.energyKWh }));

    let totalCurrentCost = 0, totalOptimizedCost = 0;
    let totalCurrentCarbon = 0, totalOptimizedCarbon = 0;
    let shutdownCount = 0;
    const regionMetrics = {};

    resources.forEach(node => {
      totalCurrentCost += node.costINR || 0;
      totalCurrentCarbon += node.carbonKg || 0;

      const { recommendation, savingsPercent } = generateOptimizationRules(node);

      let optCost = node.costINR;
      let optCarbon = node.carbonKg;

      if (recommendation === "Shutdown Server") {
        optCost = 0;
        optCarbon = 0;
        shutdownCount++;
      } else if (recommendation === "Rightsize Instance" || recommendation === "Auto Shutdown Schedule (Off-Hours)") {
        optCost = node.costINR * (1 - savingsPercent);
        optCarbon = node.carbonKg * (1 - savingsPercent);
      } else if (recommendation.includes("Migrate to Lower-Carbon Region")) {
        optCarbon = carbonAtZone(node.energyKWh, getLowestFactorZone());
      }

      totalOptimizedCost += optCost;
      totalOptimizedCarbon += optCarbon;

      const reg = String(node.region).toLowerCase().trim();
      if (!regionMetrics[reg]) {
        regionMetrics[reg] = { region: reg, currentCost: 0, currentCarbon: 0, count: 0 };
      }
      regionMetrics[reg].currentCost += node.costINR;
      regionMetrics[reg].currentCarbon += node.carbonKg;
      regionMetrics[reg].count += 1;
    });

    const monthlyFinancialSavings = totalCurrentCost - totalOptimizedCost;
    const annualFinancialSavings = monthlyFinancialSavings * 12;
    const carbonReductionWeight = totalCurrentCarbon - totalOptimizedCarbon;

    // Derived from the regions actually present in this fleet, not a static
    // assumption — correct whether the fleet came from a CSV upload, a real
    // AWS connection, or a mix of both.
    const zoneEntries = Object.entries(regionMetrics).sort((a, b) => b[1].currentCarbon - a[1].currentCarbon);
    const heaviestZone = zoneEntries[0];
    const lightestZone = zoneEntries[zoneEntries.length - 1];
    const nonProdShare = totalCurrentCost > 0
      ? Math.round((resources.filter(r => r.environment !== 'production').reduce((a, r) => a + (r.costINR || 0), 0) / totalCurrentCost) * 100)
      : 0;
    // Live against current thresholds, not the stored snapshot — see the
    // same note in optimizeController.buildRecommendations().
    const overloaded = resources.filter(r => getClassification(r.cpuUtilization) === 'Overloaded').sort((a, b) => b.cpuUtilization - a.cpuUtilization)[0];

    const aiInsights = [
      `Potential Monthly Overhead Savings: Evaluation identifies an immediate operational cash reduction of ₹${monthlyFinancialSavings.toFixed(2)} available.`,
      `Projected Annual ROI Acceleration: Scaling optimizations across these assets will yield an estimated annualized profitability increase of ₹${annualFinancialSavings.toFixed(2)}.`,
      `Critical Resource Remediation: ${shutdownCount} server instance(s) are operating below acceptable CPU index parameters and are recommended for shutdown.`,
      heaviestZone && lightestZone && heaviestZone[0] !== lightestZone[0]
        ? `Zone Spread: ${zoneLabel(heaviestZone[0])} carries the largest share of fleet carbon at ${gridFactorFor(heaviestZone[0])} gCO₂/kWh, against ${zoneLabel(lightestZone[0])}'s ${gridFactorFor(lightestZone[0])} gCO₂/kWh — moving eligible workloads there can neutralize up to ${carbonReductionWeight.toFixed(2)} kg of active grid CO₂ footprint.`
        : `Carbon Abatement Opportunity: Shifting intense workloads to the fleet's cleanest zone can neutralize up to ${carbonReductionWeight.toFixed(2)} kg of active grid CO₂ footprint.`,
      `Non-prod Drag: dev and test instances account for ${nonProdShare}% of spend. An off-hours schedule halves it without touching production.`,
      overloaded
        ? `Headroom Risk: ${overloaded.serverName} sits at ${overloaded.cpuUtilization}% CPU. It is not a savings candidate — flag it for scale-out before the next traffic peak.`
        : `Headroom Risk: no instance is currently flagged Overloaded.`
    ];

    return {
      success: true,
      top5Highest: top5Consumers,
      top5Lowest: lowest5Consumers,
      costTrend: [
        { timeline: 'Current Base', Cost: parseFloat(totalCurrentCost.toFixed(2)) },
        { timeline: 'Optimized Target', Cost: parseFloat(totalOptimizedCost.toFixed(2)) }
      ],
      carbonTrend: [
        { timeline: 'Current Base', Carbon: parseFloat(totalCurrentCarbon.toFixed(2)) },
        { timeline: 'Optimized Target', Carbon: parseFloat(totalOptimizedCarbon.toFixed(2)) }
      ],
      regionData: Object.values(regionMetrics).map(r => ({ ...r, label: zoneLabel(r.region), factor: gridFactorFor(r.region) })),
      aiInsights,
      summary: {
        monthlySavings: monthlyFinancialSavings.toFixed(2),
        annualSavings: annualFinancialSavings.toFixed(2),
        carbonSaved: carbonReductionWeight.toFixed(2)
      }
    };
}

exports.buildAnalytics = buildAnalytics;

exports.getAnalyticsTrends = async (req, res) => {
  try {
    res.json(await buildAnalytics());
  } catch (err) {
    console.error("Analytics calculations delivery failure:", err);
    res.status(500).json({ success: false, error: "Failed to parse data models across tracking intervals." });
  }
};

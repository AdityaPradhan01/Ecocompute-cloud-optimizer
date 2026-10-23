const CloudResource = require('../models/CloudResource');
const { generateOptimizationRules, carbonAtZone, getLowestFactorZone, getClassification } = require('../utils/carbonMath');
const { logAudit } = require('../utils/audit');
const { EC2Client, StopInstancesCommand } = require('@aws-sdk/client-ec2');
const { resolveCredentials } = require('../utils/awsCredentials');
const Connection = require('../models/Connection');

// 1. Fetch current infrastructure profiles and append automated recommendations
// Exported separately from the HTTP handler so the scheduled report-delivery
// job (backend/utils/reportDelivery.js) computes the exact same numbers the
// live Optimize screen shows — one source of truth, no drift between what's
// on screen and what gets emailed.
async function buildRecommendations() {
  const resources = await CloudResource.find();

  return resources.map(node => {
    const { recommendation, savingsPercent } = generateOptimizationRules(node);

    return {
      _id: node._id,
      serverName: node.serverName,
      region: node.region,
      cpuUtilization: node.cpuUtilization,
      // Computed live against current thresholds, not the stored snapshot
      // from ingest time — otherwise this can disagree with `recommendation`
      // below (also computed live) the moment someone edits thresholds in
      // Settings without re-uploading the fleet.
      classification: getClassification(node.cpuUtilization),
      environment: node.environment,
      currentEnergyKWh: node.energyKWh,
      currentCarbonKg: node.carbonKg,
      currentCostINR: node.costINR,
      recommendation,
      savingsPercent: savingsPercent * 100, // Convert fraction to percentage display
      // Persisted by /api/optimize/apply — read back here so the frontend
      // can rebuild the "Estimate computed" banner from the database on
      // every page load, instead of a local state var that resets the
      // moment this page unmounts (e.g. navigating away and back).
      isOptimized: !!node.isOptimized,
      optimizedEnergyKWh: node.optimizedEnergyKWh,
      optimizedCarbonKg: node.optimizedCarbonKg,
      optimizedCostINR: node.optimizedCostINR,
      // Present only for resources discovered via a live AWS connection —
      // this is what the frontend uses to offer the real "Shut down on
      // AWS" action instead of just the fleet-wide savings estimate.
      isLiveAws: !!(node.sourceConnectionId && node.awsInstanceId),
      awsInstanceId: node.awsInstanceId || null
    };
  });
}

exports.buildRecommendations = buildRecommendations;

exports.getRecommendations = async (req, res) => {
  try {
    res.json(await buildRecommendations());
  } catch (error) {
    console.error("Error generating system recommendations:", error);
    res.status(500).json({ error: "Failed to compile infrastructure recommendations." });
  }
};

// 2. Apply recommendations and calculate delta optimizations (Before vs After)
exports.applyOptimization = async (req, res) => {
  try {
    const resources = await CloudResource.find();

    let totalMonthlySavingsINR = 0;
    let totalEnergyReductionKWh = 0;
    let totalCarbonReductionKg = 0;
    let logsWritten = 0;

    for (let node of resources) {
      const { recommendation, savingsPercent } = generateOptimizationRules(node);

      if (savingsPercent > 0 || recommendation.includes("Migrate")) {
        // Evaluate mathematical reduction impacts
        let optimizedEnergy = node.energyKWh;
        let optimizedCarbon = node.carbonKg;
        let optimizedCost = node.costINR;

        if (recommendation === "Shutdown Server") {
          optimizedEnergy = 0;
          optimizedCarbon = 0;
          optimizedCost = 0;
        } else if (recommendation === "Rightsize Instance") {
          optimizedEnergy = node.energyKWh * 0.60; // 40% Savings means 60% remains
          optimizedCost = node.costINR * 0.60;
          optimizedCarbon = node.carbonKg * 0.60;
        } else if (recommendation === "Auto Shutdown Schedule (Off-Hours)") {
          optimizedEnergy = node.energyKWh * 0.50; // 50% Savings
          optimizedCost = node.costINR * 0.50;
          optimizedCarbon = node.carbonKg * 0.50;
        } else if (recommendation.includes("Migrate to Lower-Carbon Region")) {
          // Retains original processing energy & cost; carbon drops to the
          // fleet's lowest-intensity region instead.
          optimizedCarbon = carbonAtZone(node.energyKWh, getLowestFactorZone());
        }

        // Calculate absolute asset drops
        totalMonthlySavingsINR += (node.costINR - optimizedCost);
        totalEnergyReductionKWh += (node.energyKWh - optimizedEnergy);
        totalCarbonReductionKg += (node.carbonKg - optimizedCarbon);

        // Update entry state inside MongoDB database schema
        node.isOptimized = true;
        node.optimizedEnergyKWh = parseFloat(optimizedEnergy.toFixed(3));
        node.optimizedCarbonKg = parseFloat(optimizedCarbon.toFixed(3));
        node.optimizedCostINR = parseFloat(optimizedCost.toFixed(2));
        node.recommendationApplied = recommendation;
        await node.save();
        logsWritten++;
      }
    }

    await logAudit(`Optimization strategy applied — ${logsWritten} instance logs written`);

    res.json({
      success: true,
      message: "Infrastructure resource optimization rules applied successfully!",
      metrics: {
        monthlySavingsINR: parseFloat(totalMonthlySavingsINR.toFixed(2)),
        annualSavingsINR: parseFloat((totalMonthlySavingsINR * 12).toFixed(2)), // Monthly * 12
        co2ReductionKg: parseFloat(totalCarbonReductionKg.toFixed(2)),
        energyReductionKWh: parseFloat(totalEnergyReductionKWh.toFixed(2)),
        logsWritten
      }
    });
  } catch (error) {
    console.error("Error executing infrastructure action plans:", error);
    res.status(500).json({ error: "Optimization batch transaction execution fault." });
  }
};

// 3. Execute a shutdown on the real AWS instance behind a resource — the one
// deliberately narrow case where this app mutates your actual infrastructure
// rather than only estimating savings. Guarded on every axis: AWS-sourced
// resources only, Shutdown-only (the one safe, reversible action), and a
// typed confirmation (the exact server name) so this can't be fat-fingered.
exports.applyAwsShutdown = async (req, res) => {
  try {
    const { confirm } = req.body;
    const node = await CloudResource.findById(req.params.resourceId);
    if (!node) return res.status(404).json({ error: 'Resource not found.' });

    if (!node.sourceConnectionId || !node.awsInstanceId) {
      return res.status(400).json({ error: 'This resource was not discovered via a live AWS connection — nothing to execute.' });
    }

    const { recommendation } = generateOptimizationRules(node);
    if (recommendation !== 'Shutdown Server') {
      return res.status(400).json({ error: `Current recommendation is "${recommendation}", not Shutdown Server — refusing to stop this instance.` });
    }

    if (confirm !== node.serverName) {
      return res.status(400).json({ error: 'Confirmation text did not match the server name.' });
    }

    const connection = await Connection.findById(node.sourceConnectionId);
    if (!connection) return res.status(404).json({ error: 'Source connection no longer exists.' });

    const creds = await resolveCredentials(connection);
    const ec2 = new EC2Client({ credentials: creds, region: node.region });
    const result = await ec2.send(new StopInstancesCommand({ InstanceIds: [node.awsInstanceId] }));

    node.isOptimized = true;
    node.recommendationApplied = 'Shutdown Server (executed on AWS)';
    await node.save();

    const newState = result.StoppingInstances?.[0]?.CurrentState?.Name || 'stopping';
    await logAudit(`Executed real AWS shutdown — ${node.serverName} (${node.awsInstanceId}, ${node.region}) → ${newState}`);

    res.json({ success: true, instanceId: node.awsInstanceId, state: newState });
  } catch (error) {
    console.error('Error executing AWS shutdown:', error);
    res.status(500).json({ error: 'Failed to execute the shutdown on AWS.' });
  }
};

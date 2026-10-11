const mongoose = require('mongoose');

const CloudResourceSchema = new mongoose.Schema({
  serverName: { type: String, required: true },
  instanceType: { type: String, default: 'unknown' },
  tdp: { type: Number, required: true }, // Power draw in Watts
  cpuUtilization: { type: Number, required: true }, // CPU % utilization
  pue: { type: Number, default: 1.2 }, // Locked to 1.2 per specification
  region: { type: String, required: true }, // real AWS region code (e.g. ap-south-1, us-east-1) — same for CSV uploads, the demo dataset, and live AWS connections
  sourceConnectionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Connection' }, // set when discovered via a live connection sync
  awsInstanceId: { type: String }, // real EC2 instance id (e.g. i-0abcd1234), set only for AWS-sourced resources — required to actually act on the instance
  hourlyRate: { type: Number, required: true }, // Hourly cost rate in ₹
  environment: { type: String, default: 'production' }, // production, dev, test
  tdpSource: { type: String, enum: ['provided', 'estimated'], default: 'provided' }, // 'estimated' for AWS-sourced resources — AWS doesn't publish per-instance power draw
  pricingSource: { type: String, enum: ['provided', 'aws-ondemand-list-price-approx'], default: 'provided' },

  // Computed Post-Detection Fields
  energyKWh: { type: Number },
  carbonKg: { type: Number },
  costINR: { type: Number },
  classification: { type: String }, // Idle, Underutilized, Optimal, Overloaded
  
  // Post-Optimization Audit Log Reference
  isOptimized: { type: Boolean, default: false },
  optimizedEnergyKWh: { type: Number },
  optimizedCarbonKg: { type: Number },
  optimizedCostINR: { type: Number },
  recommendationApplied: { type: String },
  
  uploadedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('CloudResource', CloudResourceSchema);
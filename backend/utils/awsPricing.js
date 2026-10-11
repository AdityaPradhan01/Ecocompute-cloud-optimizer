// Approximate, publicly-documented EC2 reference data — not a live pricing
// API call. AWS Cost Explorer (the source of your *actual* billed rate,
// including Savings Plans/RIs) requires IAM/Organizations access most
// accounts don't grant a third-party read-only role, so this app uses AWS's
// published on-demand list price instead and labels it as such everywhere
// it's surfaced (`pricingSource` on the API response).
//
// TDP is never published by AWS per-instance. It is estimated from vCPU
// count using the same category of approach as the open-source Cloud
// Carbon Footprint project (watts scale with vCPU count for a given
// processor generation) — labeled `tdpSource: 'estimated'` everywhere.

const INSTANCE_SPECS = {
  't3.micro': { vcpu: 2, usEast1HourlyUSD: 0.0104 },
  't3.small': { vcpu: 2, usEast1HourlyUSD: 0.0208 },
  't3.medium': { vcpu: 2, usEast1HourlyUSD: 0.0416 },
  't3.large': { vcpu: 2, usEast1HourlyUSD: 0.0832 },
  't3.xlarge': { vcpu: 4, usEast1HourlyUSD: 0.1664 },
  't3.2xlarge': { vcpu: 8, usEast1HourlyUSD: 0.3328 },
  'm5.large': { vcpu: 2, usEast1HourlyUSD: 0.096 },
  'm5.xlarge': { vcpu: 4, usEast1HourlyUSD: 0.192 },
  'm5.2xlarge': { vcpu: 8, usEast1HourlyUSD: 0.384 },
  'm5.4xlarge': { vcpu: 16, usEast1HourlyUSD: 0.768 },
  'c5.large': { vcpu: 2, usEast1HourlyUSD: 0.085 },
  'c5.xlarge': { vcpu: 4, usEast1HourlyUSD: 0.17 },
  'c5.2xlarge': { vcpu: 8, usEast1HourlyUSD: 0.34 },
  'c5.4xlarge': { vcpu: 16, usEast1HourlyUSD: 0.68 },
  'r5.large': { vcpu: 2, usEast1HourlyUSD: 0.126 },
  'r5.xlarge': { vcpu: 4, usEast1HourlyUSD: 0.252 },
  'r5.2xlarge': { vcpu: 8, usEast1HourlyUSD: 0.504 }
};
const DEFAULT_SPEC = { vcpu: 2, usEast1HourlyUSD: 0.05 }; // used for any instance type not in the table above

// Rough regional price multipliers relative to us-east-1 (approximate,
// illustrative — real AWS pricing varies by region and changes over time).
const REGION_PRICE_MULTIPLIER = {
  'us-east-1': 1.0, 'us-east-2': 1.0, 'us-west-1': 1.08, 'us-west-2': 1.0,
  'ca-central-1': 1.08, 'eu-west-1': 1.1, 'eu-west-2': 1.14, 'eu-central-1': 1.15,
  'eu-north-1': 1.05, 'ap-south-1': 0.92, 'ap-southeast-1': 1.16, 'ap-southeast-2': 1.2,
  'ap-northeast-1': 1.22, 'sa-east-1': 1.35
};

// Static, approximate USD→INR rate — not a live FX feed. Documented so cost
// figures for AWS-sourced resources are clearly "approximate", never implied
// to be your real invoice amount.
const USD_TO_INR = 83;

function getInstanceSpec(instanceType) {
  return INSTANCE_SPECS[instanceType] || DEFAULT_SPEC;
}

function estimateHourlyRateINR(instanceType, region) {
  const spec = getInstanceSpec(instanceType);
  const multiplier = REGION_PRICE_MULTIPLIER[region] ?? 1.1;
  const usd = spec.usEast1HourlyUSD * multiplier;
  return usd * USD_TO_INR;
}

// Approximated as (base server overhead) + (vCPU count × watts per vCPU),
// in the same spirit as Cloud Carbon Footprint's coefficient-based model.
const WATTS_PER_VCPU = 5.5;
const BASE_SERVER_OVERHEAD_WATTS = 12;

function estimateTdpWatts(instanceType) {
  const spec = getInstanceSpec(instanceType);
  return Math.round(BASE_SERVER_OVERHEAD_WATTS + spec.vcpu * WATTS_PER_VCPU);
}

module.exports = {
  INSTANCE_SPECS,
  USD_TO_INR,
  getInstanceSpec,
  estimateHourlyRateINR,
  estimateTdpWatts
};

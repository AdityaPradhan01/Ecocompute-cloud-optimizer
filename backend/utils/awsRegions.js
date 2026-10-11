// Real AWS region codes/names (a practical subset of commonly-used regions,
// not the full ever-changing list). This is the one region model the whole
// app uses — AWS connections, CSV uploads, and the demo dataset all
// reference these same real regions.
const AWS_REGIONS = [
  { id: 'us-east-1', label: 'US East (N. Virginia)' },
  { id: 'us-east-2', label: 'US East (Ohio)' },
  { id: 'us-west-1', label: 'US West (N. California)' },
  { id: 'us-west-2', label: 'US West (Oregon)' },
  { id: 'ca-central-1', label: 'Canada (Central)' },
  { id: 'eu-west-1', label: 'Europe (Ireland)' },
  { id: 'eu-west-2', label: 'Europe (London)' },
  { id: 'eu-central-1', label: 'Europe (Frankfurt)' },
  { id: 'eu-north-1', label: 'Europe (Stockholm)' },
  { id: 'ap-south-1', label: 'Asia Pacific (Mumbai)' },
  { id: 'ap-southeast-1', label: 'Asia Pacific (Singapore)' },
  { id: 'ap-southeast-2', label: 'Asia Pacific (Sydney)' },
  { id: 'ap-northeast-1', label: 'Asia Pacific (Tokyo)' },
  { id: 'sa-east-1', label: 'South America (São Paulo)' }
];

const AWS_REGION_BY_ID = Object.fromEntries(AWS_REGIONS.map((r) => [r.id, r]));
const isAwsRegion = (id) => Object.prototype.hasOwnProperty.call(AWS_REGION_BY_ID, id);

module.exports = { AWS_REGIONS, AWS_REGION_BY_ID, isAwsRegion };

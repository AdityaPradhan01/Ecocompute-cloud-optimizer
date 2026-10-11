// Approximate national/regional electricity grid carbon intensity
// (gCO2/kWh) for the country each AWS region physically sits in. These are
// order-of-magnitude figures consistent with publicly reported grid
// averages (the kind of numbers IEA/Ember-style datasets and the AWS
// customer carbon footprint tool cite) — not a live feed, and not a
// substitute for AWS's own Customer Carbon Footprint Tool or your utility's
// disclosure for compliance-grade reporting. Treat as illustrative/ballpark.
const AWS_REGION_CARBON_INTENSITY = {
  'us-east-1': 385, // Virginia, US grid average
  'us-east-2': 450, // Ohio, coal/gas-heavier grid
  'us-west-1': 220, // California, cleaner grid mix
  'us-west-2': 105, // Oregon, hydro-heavy
  'ca-central-1': 120, // Canada, hydro/nuclear-heavy
  'eu-west-1': 330, // Ireland
  'eu-west-2': 230, // UK
  'eu-central-1': 380, // Germany
  'eu-north-1': 40, // Sweden, hydro/nuclear
  'ap-south-1': 713, // India, coal-heavy grid
  'ap-southeast-1': 408, // Singapore, gas-heavy
  'ap-southeast-2': 520, // Australia, coal-heavy
  'ap-northeast-1': 474, // Japan
  'sa-east-1': 95 // Brazil, hydro-heavy
};

const FALLBACK_AWS_FACTOR = 450; // global average fallback for a region not in the table above

function awsCarbonIntensity(region) {
  return AWS_REGION_CARBON_INTENSITY[region] ?? FALLBACK_AWS_FACTOR;
}

module.exports = { AWS_REGION_CARBON_INTENSITY, FALLBACK_AWS_FACTOR, awsCarbonIntensity };

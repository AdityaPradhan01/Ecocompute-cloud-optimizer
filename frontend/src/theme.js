// Modernist design tokens (see designs/_ds/.../readme.md in ecocompute-renew)
// plus the real-AWS-region model used across the app. Kept as one plain
// object (not CSS custom properties) because every screen in the redesign
// uses inline styles, matching the prototype.

export const COLOR = {
  ink: '#121211',
  inkSoft: '#2c2c29',
  paper: '#ffffff',
  canvas: '#f6f6f3',
  body: '#3d3d39',
  muted: '#6b6b66',
  mutedDark: '#8d8d86',
  copyDark: '#c9c9c2',
  hairline: '#e4e4de',
  hairline2: '#d8d8d2',
  track: '#ededE7',
  yellow: '#f5c518',
  yellowHover: '#d9a900',
  yellowTint: '#fdf6dd',
  yellowTint2: '#fdf1c2',
  yellowInk: '#4a3d00',
  yellowInk2: '#584700',
  yellowBorder: '#e2c552',
  green: '#0f6b38',
  greenTint: '#e6f2ea',
  greenBorder: '#9dc7ae',
  greenLed: '#3ecf7a'
};

// Real AWS regions with approximate grid carbon intensity (gCO2/kWh) for
// the country each one sits in — mirrors backend/utils/awsCarbonIntensity.js
// and backend/utils/awsRegions.js, the single source of truth; keep this in
// sync with those. These are order-of-magnitude figures, not a live feed —
// a deployment can override any of them via Settings.
export const ZONES = [
  { id: 'us-east-1', label: 'US East (N. Virginia)', factor: 385 },
  { id: 'us-east-2', label: 'US East (Ohio)', factor: 450 },
  { id: 'us-west-1', label: 'US West (N. California)', factor: 220 },
  { id: 'us-west-2', label: 'US West (Oregon)', factor: 105 },
  { id: 'ca-central-1', label: 'Canada (Central)', factor: 120 },
  { id: 'eu-west-1', label: 'Europe (Ireland)', factor: 330 },
  { id: 'eu-west-2', label: 'Europe (London)', factor: 230 },
  { id: 'eu-central-1', label: 'Europe (Frankfurt)', factor: 380 },
  { id: 'eu-north-1', label: 'Europe (Stockholm)', factor: 40 },
  { id: 'ap-south-1', label: 'Asia Pacific (Mumbai)', factor: 713 },
  { id: 'ap-southeast-1', label: 'Asia Pacific (Singapore)', factor: 408 },
  { id: 'ap-southeast-2', label: 'Asia Pacific (Sydney)', factor: 520 },
  { id: 'ap-northeast-1', label: 'Asia Pacific (Tokyo)', factor: 474 },
  { id: 'sa-east-1', label: 'South America (São Paulo)', factor: 95 }
];

export const ZONE_BY_ID = Object.fromEntries(ZONES.map(z => [z.id, z]));
export const zoneLabel = (id) => (ZONE_BY_ID[id] ? ZONE_BY_ID[id].label : id);
export const zoneFactor = (id) => (ZONE_BY_ID[id] ? ZONE_BY_ID[id].factor : 450);

export const CLASSIFICATION_STYLE = {
  Idle: { bg: COLOR.ink, fg: COLOR.yellow, border: COLOR.ink },
  Underutilized: { bg: COLOR.yellowTint2, fg: COLOR.yellowInk2, border: COLOR.yellowBorder },
  Optimal: { bg: COLOR.greenTint, fg: COLOR.green, border: COLOR.greenBorder },
  Overloaded: { bg: COLOR.paper, fg: COLOR.ink, border: COLOR.ink }
};

export const n0 = (v) => Math.round(v || 0).toLocaleString('en-IN');
export const n1 = (v) => (Math.round((v || 0) * 10) / 10).toLocaleString('en-IN');

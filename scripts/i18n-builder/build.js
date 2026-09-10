const fs = require('fs');
const path = require('path');

const { app, auth } = require('./app-auth');
const trips = require('./trips');
const fleet = require('./fleet');
const tracking = require('./tracking');
const maintenance = require('./maintenance');
const reports = require('./reports');
const common = require('./common');

const es = {
  app,
  common,
  auth,
  trips,
  fleet,
  tracking,
  maintenance,
  reports
};

// Load ar.json to verify 100% key parity
const arPath = path.resolve(__dirname, '../../src/i18n/messages/ar.json');
const ar = JSON.parse(fs.readFileSync(arPath, 'utf8'));

function getLeaves(obj, prefix = '') {
  let res = {};
  for (const k in obj) {
    const full = prefix ? prefix + '.' + k : k;
    if (typeof obj[k] === 'object' && obj[k] !== null && !Array.isArray(obj[k])) {
      Object.assign(res, getLeaves(obj[k], full));
    } else {
      res[full] = obj[k];
    }
  }
  return res;
}

const arLeaves = getLeaves(ar);
const esLeaves = getLeaves(es);

const missingInEs = [];
for (const k of Object.keys(arLeaves)) {
  if (!(k in esLeaves)) {
    missingInEs.push(k);
  }
}

const extraInEs = [];
for (const k of Object.keys(esLeaves)) {
  if (!(k in arLeaves)) {
    extraInEs.push(k);
  }
}

console.log('=== Key Parity Verification ===');
console.log('Total keys in ar.json:', Object.keys(arLeaves).length);
console.log('Total keys in es.json:', Object.keys(esLeaves).length);
console.log('Missing in es:', missingInEs.length ? missingInEs : 'None (100% complete!)');
console.log('Extra in es:', extraInEs.length ? extraInEs : 'None');

if (missingInEs.length > 0) {
  console.error('ERROR: Missing keys in es.json:', missingInEs);
  process.exit(1);
}

// Verify variables
console.log('\n=== Variables Verification ===');
let varMismatches = 0;
for (const [k, arVal] of Object.entries(arLeaves)) {
  const arMatches = (String(arVal).match(/\{[a-zA-Z0-9_]+\}/g) || []).sort();
  const esMatches = (String(esLeaves[k]).match(/\{[a-zA-Z0-9_]+\}/g) || []).sort();
  if (arMatches.join(',') !== esMatches.join(',')) {
    console.warn(`Variable mismatch at ${k}: AR=[${arMatches}] vs ES=[${esMatches}]`);
    varMismatches++;
  }
}
if (varMismatches === 0) {
  console.log('All interpolation variables match perfectly!');
} else {
  console.error(`ERROR: ${varMismatches} variable mismatches found.`);
  process.exit(1);
}

// Write es.json
const esPath = path.resolve(__dirname, '../../src/i18n/messages/es.json');
fs.writeFileSync(esPath, JSON.stringify(es, null, 2) + '\n', 'utf8');
console.log('\nSuccessfully generated:', esPath);

// Remove en.json
const enPath = path.resolve(__dirname, '../../src/i18n/messages/en.json');
if (fs.existsSync(enPath)) {
  fs.unlinkSync(enPath);
  console.log('Successfully removed old en.json');
}

// Cleanup scratch ref files
const cleanupFiles = [
  '../../scripts/trips_ref.json',
  '../../scripts/tracking_ref.json',
  '../../scripts/maintenance_ref.json',
  '../../scripts/reports_ref.json',
  '../../scripts/fleet_ref.json',
  '../../scripts/common_ref.json',
  '../../scripts/remaining_common_keys.json',
  '../../scripts/remaining_sample.json'
];

for (const f of cleanupFiles) {
  const fullP = path.resolve(__dirname, f);
  if (fs.existsSync(fullP)) {
    fs.unlinkSync(fullP);
  }
}
console.log('Cleaned up temporary reference files.');


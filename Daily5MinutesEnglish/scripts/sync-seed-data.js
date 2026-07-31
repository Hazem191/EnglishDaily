/**
 * Copy db.json into lib/seed-data.json so Vercel serverless can seed Redis
 * (db.json is excluded from deploy via .vercelignore).
 */
const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, '..', 'db.json');
const dest = path.join(__dirname, '..', 'lib', 'seed-data.json');

if (!fs.existsSync(src)) {
  console.warn('sync-seed-data: db.json not found, skipping');
  process.exit(0);
}

fs.copyFileSync(src, dest);
console.log('sync-seed-data: copied db.json → lib/seed-data.json');

/**
 * Seed Upstash Redis from db.json (run after linking Redis storage).
 *
 *   npm install
 *   npx vercel env pull .env.local
 *   npm run seed:kv
 */
const fs = require('fs');
const path = require('path');

const KV_KEY = 'daily_english_db';

const fs = require('fs');
const path = require('path');

const KV_KEY = 'daily_english_db';

function loadEnvLocal() {
  const envPath = path.join(__dirname, '..', '.env.local');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

async function main() {
  loadEnvLocal();
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    console.error('Missing UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN.');
    console.error('Add Upstash Redis from Vercel Marketplace, then run: npx vercel env pull .env.local');
    process.exit(1);
  }

  const dbPath = path.join(__dirname, '..', 'db.json');
  if (!fs.existsSync(dbPath)) {
    console.error('db.json not found.');
    process.exit(1);
  }

  const data = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
  const { Redis } = require('@upstash/redis');
  const redis = Redis.fromEnv();
  await redis.set(KV_KEY, data);
  console.log('Seeded Upstash Redis from db.json');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

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

function hasRestEnv() {
  return Boolean(
    (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) ||
    (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN)
  );
}

async function seedWithRest(data) {
  const { Redis } = require('@upstash/redis');
  let redis;
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    redis = Redis.fromEnv();
  } else {
    redis = new Redis({
      url: process.env.KV_REST_API_URL,
      token: process.env.KV_REST_API_TOKEN
    });
  }
  await redis.set(KV_KEY, data);
}

async function seedWithUrl(data) {
  const { createClient } = require('redis');
  const client = createClient({ url: process.env.REDIS_URL });
  await client.connect();
  try {
    await client.set(KV_KEY, JSON.stringify(data));
  } finally {
    await client.quit();
  }
}

async function main() {
  loadEnvLocal();

  const dbPath = path.join(__dirname, '..', 'db.json');
  const seedPath = path.join(__dirname, '..', 'lib', 'seed-data.json');
  const source = fs.existsSync(dbPath) ? dbPath : seedPath;
  if (!fs.existsSync(source)) {
    console.error('db.json / lib/seed-data.json not found.');
    process.exit(1);
  }

  const data = JSON.parse(fs.readFileSync(source, 'utf8'));

  if (hasRestEnv()) {
    await seedWithRest(data);
    console.log('Seeded Redis (REST) from', path.basename(source));
    return;
  }

  if (process.env.REDIS_URL) {
    await seedWithUrl(data);
    console.log('Seeded Redis (REDIS_URL) from', path.basename(source));
    return;
  }

  console.error('No Redis env found. Set UPSTASH_REDIS_REST_* or KV_REST_API_* or REDIS_URL.');
  console.error('Run: npx vercel env pull .env.local');
  process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

const fs = require('fs');
const path = require('path');

const KV_KEY = 'daily_english_db';
const BACKUP_PREFIX = 'daily_english_backup:';
const MAX_BACKUPS = 5;

function hasRedisEnv() {
  return Boolean(
    process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
  );
}

function readSeedFromDisk() {
  const seedPath = path.join(process.cwd(), 'db.json');
  if (!fs.existsSync(seedPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(seedPath, 'utf8'));
  } catch {
    return null;
  }
}

function getRedis() {
  if (!hasRedisEnv()) return null;
  const { Redis } = require('@upstash/redis');
  return Redis.fromEnv();
}

async function loadDatabase() {
  const redis = getRedis();
  if (redis) {
    let data = await redis.get(KV_KEY);
    if (!data) {
      const seed = readSeedFromDisk();
      if (seed) {
        await redis.set(KV_KEY, seed);
        data = seed;
      }
    }
    return data || null;
  }

  return readSeedFromDisk();
}

async function saveDatabase(data) {
  const redis = getRedis();
  if (!redis) {
    throw new Error(
      'Redis is not configured. Add Upstash Redis from the Vercel Marketplace and link it to this project.'
    );
  }

  const backupKey = `${BACKUP_PREFIX}${Date.now()}`;
  const current = await redis.get(KV_KEY);
  if (current) {
    await redis.set(backupKey, current);
    const keys = await redis.keys(`${BACKUP_PREFIX}*`);
    if (keys.length > MAX_BACKUPS) {
      const sorted = keys.sort();
      const toDelete = sorted.slice(0, keys.length - MAX_BACKUPS);
      if (toDelete.length) await redis.del(...toDelete);
    }
  }

  await redis.set(KV_KEY, data);
}

module.exports = {
  loadDatabase,
  saveDatabase,
  hasRedisEnv,
  KV_KEY
};

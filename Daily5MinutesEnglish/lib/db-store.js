const fs = require('fs');
const path = require('path');

const KV_KEY = 'daily_english_db';
const BACKUP_PREFIX = 'daily_english_backup:';
const MAX_BACKUPS = 5;

let urlClientPromise = null;

function hasUpstashRestEnv() {
  return Boolean(
    process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
  );
}

function hasRedisUrlEnv() {
  return Boolean(process.env.REDIS_URL);
}

function hasRedisEnv() {
  return hasUpstashRestEnv() || hasRedisUrlEnv();
}

function readSeedFromDisk() {
  const candidates = [
    path.join(process.cwd(), 'db.json'),
    path.join(__dirname, '..', 'db.json')
  ];
  for (const seedPath of candidates) {
    if (!fs.existsSync(seedPath)) continue;
    try {
      return JSON.parse(fs.readFileSync(seedPath, 'utf8'));
    } catch {
      /* try next */
    }
  }
  return null;
}

function getUpstashAdapter() {
  const { Redis } = require('@upstash/redis');
  const redis = Redis.fromEnv();
  return {
    async get(key) {
      return redis.get(key);
    },
    async set(key, value) {
      await redis.set(key, value);
    },
    async keys(pattern) {
      return redis.keys(pattern);
    },
    async del(...keys) {
      if (keys.length) await redis.del(...keys);
    }
  };
}

async function getUrlClient() {
  if (!urlClientPromise) {
    const { createClient } = require('redis');
    const client = createClient({ url: process.env.REDIS_URL });
    client.on('error', (err) => console.error('Redis error:', err.message));
    urlClientPromise = client.connect().then(() => client);
  }
  return urlClientPromise;
}

function getUrlAdapter() {
  return {
    async get(key) {
      const client = await getUrlClient();
      const raw = await client.get(key);
      if (!raw) return null;
      try {
        return JSON.parse(raw);
      } catch {
        return raw;
      }
    },
    async set(key, value) {
      const client = await getUrlClient();
      await client.set(key, JSON.stringify(value));
    },
    async keys(pattern) {
      const client = await getUrlClient();
      return client.keys(pattern);
    },
    async del(...keys) {
      if (!keys.length) return;
      const client = await getUrlClient();
      await client.del(keys);
    }
  };
}

function getStore() {
  if (hasUpstashRestEnv()) return getUpstashAdapter();
  if (hasRedisUrlEnv()) return getUrlAdapter();
  return null;
}

async function loadDatabase() {
  const store = getStore();
  if (store) {
    let data = await store.get(KV_KEY);
    if (!data) {
      const seed = readSeedFromDisk();
      if (seed) {
        await store.set(KV_KEY, seed);
        data = seed;
      }
    }
    return data || null;
  }

  return readSeedFromDisk();
}

async function saveDatabase(data) {
  const store = getStore();
  if (!store) {
    throw new Error(
      'Redis is not configured. Connect Redis to the Vercel project or add UPSTASH_REDIS_REST_URL + TOKEN.'
    );
  }

  const backupKey = `${BACKUP_PREFIX}${Date.now()}`;
  const current = await store.get(KV_KEY);
  if (current) {
    await store.set(backupKey, current);
    const keys = await store.keys(`${BACKUP_PREFIX}*`);
    if (keys.length > MAX_BACKUPS) {
      const sorted = keys.sort();
      const toDelete = sorted.slice(0, keys.length - MAX_BACKUPS);
      if (toDelete.length) await store.del(...toDelete);
    }
  }

  await store.set(KV_KEY, data);
}

module.exports = {
  loadDatabase,
  saveDatabase,
  hasRedisEnv,
  KV_KEY
};

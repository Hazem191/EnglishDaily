const fs = require('fs');
const path = require('path');

const KV_KEY = 'daily_english_db';
const BACKUP_PREFIX = 'daily_english_backup:';
const MAX_BACKUPS = 5;

function getUpstashConfig() {
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    return {
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN
    };
  }
  if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
    return {
      url: process.env.KV_REST_API_URL,
      token: process.env.KV_REST_API_TOKEN
    };
  }
  return null;
}

function hasUpstashRestEnv() {
  return Boolean(getUpstashConfig());
}

function hasRedisUrlEnv() {
  return Boolean(process.env.REDIS_URL);
}

function hasRedisEnv() {
  return hasUpstashRestEnv() || hasRedisUrlEnv();
}

function readBundledSeed() {
  try {
    return require('./seed-data.json');
  } catch {
    return null;
  }
}

function readSeedFromDisk() {
  const candidates = [
    path.join(__dirname, 'seed-data.json'),
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

function readSeed() {
  return readSeedFromDisk() || readBundledSeed();
}

function getUpstashAdapter() {
  const { Redis } = require('@upstash/redis');
  const cfg = getUpstashConfig();
  const redis = new Redis({ url: cfg.url, token: cfg.token });
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

async function withUrlClient(fn) {
  const { createClient } = require('redis');
  const client = createClient({
    url: process.env.REDIS_URL,
    socket: { connectTimeout: 8000 }
  });
  client.on('error', (err) => console.error('Redis error:', err.message));
  await client.connect();
  try {
    return await fn(client);
  } finally {
    try {
      await client.quit();
    } catch {
      /* ignore */
    }
  }
}

function getUrlAdapter() {
  return {
    async get(key) {
      return withUrlClient(async (client) => {
        const raw = await client.get(key);
        if (!raw) return null;
        try {
          return JSON.parse(raw);
        } catch {
          return raw;
        }
      });
    },
    async set(key, value) {
      return withUrlClient(async (client) => {
        await client.set(key, JSON.stringify(value));
      });
    },
    async keys(pattern) {
      return withUrlClient((client) => client.keys(pattern));
    },
    async del(...keys) {
      if (!keys.length) return;
      return withUrlClient((client) => client.del(keys));
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
      const seed = readSeed();
      if (seed) {
        await store.set(KV_KEY, seed);
        data = seed;
        console.log('Seeded Redis from bundled seed-data.json');
      }
    }
    return data || null;
  }

  return readSeed();
}

async function saveDatabase(data) {
  const store = getStore();
  if (!store) {
    throw new Error(
      'Redis is not configured. Add Upstash Redis (UPSTASH_REDIS_REST_URL + TOKEN or KV_REST_API_URL + TOKEN) or REDIS_URL.'
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

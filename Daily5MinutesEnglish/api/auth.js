const crypto = require('crypto');
const { loadDatabase, saveDatabase, readSeed } = require('../lib/db-store');

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-API-Token');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
}

function hashPassword(password) {
  return crypto.createHash('sha256').update(String(password)).digest('hex');
}

function isHashed(str) {
  return typeof str === 'string' && str.length === 64 && /^[0-9a-f]+$/i.test(str);
}

function parseBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch {
      return null;
    }
  }
  return null;
}

async function handleLogin(body, res) {
  const email = (body.email || '').trim().toLowerCase();
  const password = body.password || '';
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }

  const data = await loadDatabase();
  if (!data?.users) {
    return res.status(500).json({ error: 'Database unavailable' });
  }

  const admins = data.users.admins || {};
  const students = data.users.students || {};
  const allEntries = [
    ...Object.entries(admins).map(([uid, u]) => [uid, u, 'teacher']),
    ...Object.entries(students).map(([uid, u]) => [uid, u, 'student'])
  ];

  const match = allEntries.find(([, u]) => (u.email || '').trim().toLowerCase() === email);
  if (!match) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const [uid, user, role] = match;
  let stored = user.password || '';
  const hashedInput = hashPassword(password);

  if (!stored) {
    const seed = readSeed();
    const seedUsers = { ...(seed?.users?.admins || {}), ...(seed?.users?.students || {}) };
    const seedMatch = Object.values(seedUsers).find(
      (u) => (u.email || '').trim().toLowerCase() === email && u.password
    );
    if (seedMatch?.password) {
      stored = seedMatch.password;
      const upgraded = JSON.parse(JSON.stringify(data));
      if (role === 'teacher') upgraded.users.admins[uid].password = stored;
      else upgraded.users.students[uid].password = stored;
      try {
        await saveDatabase(upgraded);
      } catch (err) {
        console.error('Could not persist restored password:', err.message);
      }
    }
  }

  const ok = isHashed(stored) ? stored === hashedInput : stored === password;
  if (!ok) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  if (!isHashed(stored) && stored.length > 0) {
    const upgraded = JSON.parse(JSON.stringify(data));
    if (role === 'teacher') upgraded.users.admins[uid].password = hashedInput;
    else upgraded.users.students[uid].password = hashedInput;
    await saveDatabase(upgraded);
  }

  return res.status(200).json({
    uid,
    email: user.email,
    name: user.name || '',
    role
  });
}

async function handleRegister(body, res) {
  const name = (body.name || '').trim();
  const email = (body.email || '').trim().toLowerCase();
  const password = body.password || '';

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'All fields required' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password too short' });
  }

  const data = (await loadDatabase()) || { users: { admins: {}, students: {} }, questions: {}, dailyResults: {}, config: {} };
  data.users = data.users || { admins: {}, students: {} };
  data.users.students = data.users.students || {};

  const allEmails = [
    ...Object.values(data.users.admins || {}),
    ...Object.values(data.users.students || {})
  ].map((u) => (u.email || '').trim().toLowerCase());

  if (allEmails.includes(email)) {
    return res.status(409).json({ error: 'Email already registered' });
  }

  const uid = 'u-' + crypto.randomBytes(6).toString('hex');
  data.users.students[uid] = {
    id: uid,
    name,
    email,
    password: hashPassword(password),
    role: 'student',
    totalScore: 0,
    createdAt: Date.now()
  };

  await saveDatabase(data);

  return res.status(201).json({
    uid,
    email,
    name,
    role: 'student'
  });
}

async function handler(req, res) {
  setCors(res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const body = parseBody(req);
  if (!body?.action) {
    return res.status(400).json({ error: 'Missing action' });
  }

  // Login/register are public — credentials are verified server-side.
  try {
    if (body.action === 'login') return await handleLogin(body, res);
    if (body.action === 'register') return await handleRegister(body, res);
    return res.status(400).json({ error: 'Unknown action' });
  } catch (err) {
    console.error('auth error:', err);
    return res.status(500).json({ error: err.message || 'Authentication failed' });
  }
}

handler.config = {
  maxDuration: 15,
  api: {
    bodyParser: {
      sizeLimit: '1mb'
    }
  }
};

module.exports = handler;

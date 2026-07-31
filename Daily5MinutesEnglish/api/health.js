const { loadDatabase, hasRedisEnv } = require('../lib/db-store');

async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const data = await loadDatabase();
    const students = data?.users?.students ? Object.keys(data.users.students).length : 0;
    const questions = data?.questions ? Object.keys(data.questions).length : 0;

    return res.status(200).json({
      ok: true,
      redis: hasRedisEnv(),
      database: Boolean(data),
      students,
      questions,
      time: new Date().toISOString()
    });
  } catch (err) {
    console.error('health check failed:', err);
    return res.status(500).json({
      ok: false,
      redis: hasRedisEnv(),
      error: err.message || 'Health check failed'
    });
  }
}

module.exports = handler;

const { mergeDatabase } = require('../lib/db-merge');
const { loadDatabase, saveDatabase } = require('../lib/db-store');
const { stripSensitiveFields } = require('../lib/sanitize-db');

const API_SECRET = process.env.API_SECRET || 'daily-english-secure-2025-key';

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Requested-With, X-API-Token, X-Requesting-Admin');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
}

function isAuthorized(req) {
  const token = req.headers['x-api-token'] || '';
  return token === API_SECRET;
}

async function handler(req, res) {
  setCors(res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (!isAuthorized(req)) {
    return res.status(401).json({ error: 'Unauthorized — missing or invalid API token' });
  }

  if (req.method === 'GET') {
    try {
      const data = await loadDatabase();
      if (!data) {
        return res.status(404).json({ status: 'error', message: 'Database not found' });
      }
      return res.status(200).json(stripSensitiveFields(data));
    } catch (err) {
      console.error('GET /api/db failed:', err);
      return res.status(500).json({ error: 'Could not read database' });
    }
  }

  if (req.method === 'POST') {
    let inputData = req.body;
    if (!inputData || typeof inputData !== 'object') {
      try {
        inputData = typeof req.body === 'string' ? JSON.parse(req.body) : null;
      } catch {
        inputData = null;
      }
    }

    if (!inputData) {
      return res.status(400).json({ error: 'Invalid JSON payload' });
    }

    try {
      const currentState = (await loadDatabase()) || {};
      const requestingAdmin = req.headers['x-requesting-admin'] || '';
      const merged = mergeDatabase(currentState, inputData, requestingAdmin);
      await saveDatabase(merged);
      return res.status(200).json({ status: 'success', synced_at: Math.floor(Date.now() / 1000) });
    } catch (err) {
      console.error('POST /api/db failed:', err);
      return res.status(500).json({ error: err.message || 'Could not save database' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

handler.config = {
  api: {
    bodyParser: {
      sizeLimit: '4mb'
    }
  }
};

module.exports = handler;

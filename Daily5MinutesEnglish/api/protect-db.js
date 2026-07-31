module.exports = function handler(_req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.status(403).json({ error: 'Direct access forbidden' });
};

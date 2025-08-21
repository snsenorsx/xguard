// Simple blacklist test without dependencies
const express = require('express');
const app = express();

// Test data
const blacklist = new Set(['192.168.1.100', '10.0.0.50']);

app.get('/api/blacklist/check/:ip', (req, res) => {
  const { ip } = req.params;
  const isBlacklisted = blacklist.has(ip);
  
  res.json({
    ip,
    isBlacklisted,
    timestamp: new Date().toISOString()
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

const port = 3001;
app.listen(port, () => {
  console.log(`Simple blacklist test server running on port ${port}`);
});
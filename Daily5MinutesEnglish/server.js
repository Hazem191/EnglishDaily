const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.static(__dirname));

// API to get database
app.get('/api/db', (req, res) => {
    fs.readFile(path.join(__dirname, 'db.json'), 'utf8', (err, data) => {
        if (err) return res.status(500).send("Error reading file");
        res.json(JSON.parse(data));
    });
});

// API to save database
app.post('/api/db', (req, res) => {
    const data = JSON.stringify(req.body, null, 4);
    fs.writeFile(path.join(__dirname, 'db.json'), data, 'utf8', (err) => {
        if (err) return res.status(500).send("Error writing file");
        console.log("📁 db.json updated successfully!");
        res.send("Success");
    });
});

app.listen(PORT, () => {
    console.log(`🚀 Server running at http://localhost:${PORT}`);
    console.log(`📝 Changes will now be automatically saved to db.json`);
});

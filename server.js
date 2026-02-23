const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

// 1. Connect to PostgreSQL
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
});

// 2. Create table if it does not exist (Run only once)
const initDb = async () => {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS locations (
            id SERIAL PRIMARY KEY,
            student_id TEXT,
            latitude DOUBLE PRECISION,
            longitude DOUBLE PRECISION,
            timestamp BIGINT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    `);
    console.log("✅ Database table is ready");
};
initDb();

// 3. API to receive data from the App
app.post('/api/location', async (req, res) => {
    const { studentId, latitude, longitude, timestamp } = req.body;
    try {
        await pool.query(
            'INSERT INTO locations (student_id, latitude, longitude, timestamp) VALUES ($1, $2, $3, $4)',
            [studentId, latitude, longitude, timestamp]
        );
        console.log(`📍 GPS saved for: ${studentId}`);
        res.status(200).send("Saved to Postgres");
    } catch (err) {
        console.error(err);
        res.status(500).send("Database error");
    }
});

// 4. API to get data for Web Monitor
app.get('/api/history', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM locations ORDER BY created_at DESC LIMIT 100');
        res.json(result.rows);
    } catch (err) { 
        res.status(500).send(err); 
    }
});

// 5. Web Monitor interface (Same as previous version)
app.get('/monitor', (req, res) => {
    res.send(`
        <html>
            <head>
                <title>GPS Web Monitor</title>
                <link rel="stylesheet" href="https://unpkg.com/leaflet/dist/leaflet.css" />
                <script src="https://unpkg.com/leaflet/dist/leaflet.js"></script>
                <style>#map { height: 100vh; width: 100%; }</style>
            </head>
            <body>
                <div id="map"></div>
                <script>
                    var map = L.map('map').setView([10.762622, 106.660172], 13);
                    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
                    let markers = {};

                    async function updateMap() {
                        const res = await fetch('/api/history');
                        const data = await res.json();
                        data.forEach(p => {
                            if (!markers[p.student_id]) {
                                markers[p.student_id] = L.marker([p.latitude, p.longitude]).addTo(map);
                            } else {
                                markers[p.student_id].setLatLng([p.latitude, p.longitude]);
                            }
                            markers[p.student_id].bindPopup('Employee: ' + p.student_id);
                        });
                    }
                    setInterval(updateMap, 5000);
                    updateMap();
                </script>
            </body>
        </html>
    `);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Server is running on port ${PORT}`));

const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');

const app = express();

// Middleware
app.use(express.json());
app.use(cors());

console.log("⚡ Starting Server with SSL Fix...");

// 1. Database Connection Configuration
// Using the DATABASE_URL environment variable from Render
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        // Essential for Supabase + Render connection
        rejectUnauthorized: false
    }
});

// 2. Initialize Database Table
const initDb = async () => {
    try {
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
    } catch (err) {
        console.error("❌ Database Initialization Error:", err.message);
    }
};
initDb();

// 3. API Route: Receive GPS data from the Mobile App
app.post('/api/location', async (req, res) => {
    const { studentId, latitude, longitude, timestamp } = req.body;
    try {
        await pool.query(
            'INSERT INTO locations (student_id, latitude, longitude, timestamp) VALUES ($1, $2, $3, $4)',
            [studentId, latitude, longitude, timestamp]
        );
        console.log(`📍 Location saved for Student ID: ${studentId}`);
        res.status(200).send("Data saved successfully");
    } catch (err) {
        console.error("❌ Insert Error:", err.message);
        res.status(500).send("Internal Server Error");
    }
});

// 4. API Route: Fetch location history for the Web Monitor
app.get('/api/history', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM locations ORDER BY created_at DESC LIMIT 100');
        res.json(result.rows);
    } catch (err) {
        console.error("❌ Fetch Error:", err.message);
        res.status(500).send("Internal Server Error");
    }
});

// 5. Basic Health Check Route
app.get('/', (req, res) => {
    res.send("GPS Tracker Server is Online!");
});

// 6. Web Monitor UI (Leaflet Map)
app.get('/monitor', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>GPS Monitor</title>
            <link rel="stylesheet" href="https://unpkg.com/leaflet/dist/leaflet.css" />
            <script src="https://unpkg.com/leaflet/dist/leaflet.js"></script>
            <style>#map { height: 100vh; width: 100%; }</style>
        </head>
        <body>
            <div id="map"></div>
            <script>
                const map = L.map('map').setView([10.762622, 106.660172], 13);
                L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
                let markers = {};

                async function updateMap() {
                    try {
                        const response = await fetch('/api/history');
                        const data = await response.json();
                        data.forEach(p => {
                            if (!markers[p.student_id]) {
                                markers[p.student_id] = L.marker([p.latitude, p.longitude]).addTo(map);
                            } else {
                                markers[p.student_id].setLatLng([p.latitude, p.longitude]);
                            }
                            markers[p.student_id].bindPopup('Student: ' + p.student_id);
                        });
                    } catch (err) {
                        console.error('Error updating map:', err);
                    }
                }
                setInterval(updateMap, 5000);
                updateMap();
            </script>
        </body>
        </html>
    `);
});

// 7. Start the Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server is running on port ${PORT}`);
});

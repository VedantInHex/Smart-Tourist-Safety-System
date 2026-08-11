const express = require('express');
const cors = require('cors');
const db = require('./db');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// API Routers
const authRouter = require('./routes/auth');
const digitalIdRouter = require('./routes/digitalId');
const locationRouter = require('./routes/location');
const geofenceRouter = require('./routes/geofence');
const incidentsRouter = require('./routes/incidents');
const aiRouter = require('./routes/ai');

app.use('/api/auth', authRouter);
app.use('/api/digital-id', digitalIdRouter);
app.use('/api/location', locationRouter);
app.use('/api/geofence', geofenceRouter);
app.use('/api/incidents', incidentsRouter);
app.use('/api/ai', aiRouter);

// Health Check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', database: db.isPostgres() ? 'postgresql' : 'simulated-fallback' });
});

// Initialize DB and Start Server
async function startServer() {
  await db.initDb();
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}

startServer();

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const https = require('https');
const path = require('path');
const db = require('./db');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;
const HTTPS_ENABLED = process.env.HTTPS_ENABLED === 'true';
const HTTPS_PORT = Number(process.env.HTTPS_PORT || 443);

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
const itineraryRouter = require('./routes/itinerary');

app.use('/api/auth', authRouter);
app.use('/api/digital-id', digitalIdRouter);
app.use('/api/location', locationRouter);
app.use('/api/geofence', geofenceRouter);
app.use('/api/incidents', incidentsRouter);
app.use('/api/ai', aiRouter);
app.use('/api/itinerary', itineraryRouter);

// Health Check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', database: db.isPostgres() ? 'postgresql' : 'simulated-fallback' });
});

// Serve client static assets if production build exists
const clientDistPath = path.join(__dirname, '../client/dist');
if (fs.existsSync(clientDistPath)) {
  console.log(`Serving static client files from: ${clientDistPath}`);
  app.use(express.static(clientDistPath));
  app.get('/*splat', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/health')) {
      return next();
    }
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
}


// Initialize DB and Start Server
async function startServer() {
  await db.initDb();

  if (HTTPS_ENABLED) {
    const keyPath = process.env.HTTPS_KEY_PATH;
    const certPath = process.env.HTTPS_CERT_PATH;
    if (!keyPath || !certPath) {
      throw new Error('HTTPS is enabled, but HTTPS_KEY_PATH and HTTPS_CERT_PATH must both be set.');
    }

    const httpsOptions = {
      key: fs.readFileSync(path.resolve(__dirname, keyPath)),
      cert: fs.readFileSync(path.resolve(__dirname, certPath))
    };

    https.createServer(httpsOptions, app).listen(HTTPS_PORT, () => {
      console.log(`HTTPS server is running on port ${HTTPS_PORT}`);
    });
    return;
  }

  app.listen(PORT, () => {
    console.log(`HTTP server is running on port ${PORT}. Use HTTPS_ENABLED=true for direct TLS deployment.`);
  });
}

startServer();

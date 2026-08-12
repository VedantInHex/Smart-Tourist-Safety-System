const router = require('express').Router();
const db = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');

// Ray-casting Point-in-Polygon algorithm
function isPointInPolygon(point, polygonCoordinates) {
  const x = point[0]; // longitude
  const y = point[1]; // latitude
  let inside = false;

  for (let i = 0, j = polygonCoordinates.length - 1; i < polygonCoordinates.length; j = i++) {
    const xi = polygonCoordinates[i][0];
    const yi = polygonCoordinates[i][1];
    const xj = polygonCoordinates[j][0];
    const yj = polygonCoordinates[j][1];

    const intersect = ((yi > y) !== (yj > y))
        && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

function checkGeofence(lat, lng, polygonGeoJSON) {
  try {
    let coords = [];
    if (polygonGeoJSON.type === 'Feature') {
      coords = polygonGeoJSON.geometry.coordinates[0];
    } else if (polygonGeoJSON.type === 'Polygon') {
      coords = polygonGeoJSON.coordinates[0];
    } else if (polygonGeoJSON.coordinates) {
      coords = polygonGeoJSON.coordinates[0];
    } else {
      coords = polygonGeoJSON;
    }
    
    // In GeoJSON point is [lng, lat]
    return isPointInPolygon([lng, lat], coords);
  } catch (err) {
    console.error("Failed to parse polygon coordinates for geofence check:", err);
    return false;
  }
}

// Update Tourist Location & Check Geofences
router.post('/update', requireAuth, async (req, res) => {
  const { user_id, latitude, longitude, timestamp } = req.body;

  if (!user_id || latitude === undefined || longitude === undefined) {
    return res.status(400).json({ error: "Missing required fields: user_id, latitude, longitude" });
  }

  // Enforce that tourists can only update their own location
  if (req.user.role !== 'admin' && req.user.id !== parseInt(user_id)) {
    return res.status(403).json({ error: "Access denied. Can only update your own location." });
  }

  try {
    const locTimestamp = timestamp ? new Date(timestamp) : new Date();

    // 1. Save new location
    const insertLoc = await db.query(
      `INSERT INTO locations (user_id, latitude, longitude, timestamp)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [user_id, latitude, longitude, locTimestamp]
    );

    // 2. Fetch all defined risk zones to run geofencing
    const zonesResult = await db.query('SELECT * FROM risk_zones');
    const triggeredZones = [];

    for (let zone of zonesResult.rows) {
      let geojson = zone.polygon_geojson;
      if (typeof geojson === 'string') {
        try {
          geojson = JSON.parse(geojson);
        } catch (e) {}
      }

      const isInside = checkGeofence(latitude, longitude, geojson);
      if (isInside) {
        triggeredZones.push(zone);

        // Auto-create a geofence incident if high risk
        if (zone.risk_level === 'High' || zone.risk_level === 'Medium') {
          // Check if there's already an active (Open/In Progress) geofence incident for this user in this zone to prevent duplicates
          const activeIncidentCheck = await db.query(
            `SELECT * FROM incidents 
             WHERE user_id = $1 AND type = $2 AND status != 'Resolved' AND ai_risk_score = $3 
             LIMIT 1`,
            [user_id, 'geofence', zone.risk_level]
          );

          if (activeIncidentCheck.rows.length === 0) {
            const incResult = await db.query(
              `INSERT INTO incidents (user_id, type, latitude, longitude, status, ai_risk_score, created_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
              [user_id, 'geofence', latitude, longitude, 'Open', zone.risk_level, new Date()]
            );
            
            const newIncident = incResult.rows[0];

            // Send an alert
            const alertMsg = `User entered danger geofence zone: "${zone.name}" (${zone.risk_level} Risk)`;
            await db.query(
              `INSERT INTO alerts (user_id, incident_id, message, sent_at)
               VALUES ($1, $2, $3, $4)`,
              [user_id, newIncident.id, alertMsg, new Date()]
            );
          }
        }
      }
    }

    res.status(200).json({
      message: "Location updated successfully",
      location: insertLoc.rows[0],
      triggeredGeofences: triggeredZones
    });

  } catch (err) {
    console.error("Location Update Error:", err);
    res.status(500).json({ error: "Server error saving location." });
  }
});

// Get Live Locations of all active tourists
router.get('/live', requireAuth, requireAdmin, async (req, res) => {
  try {
    // SQL for getting latest location per user (only tourists)
    // If Postgres is active, we can run a DISTINCT ON or Window function:
    let result;
    if (db.isPostgres()) {
      result = await db.query(`
        SELECT DISTINCT ON (l.user_id) 
          l.id, l.user_id, l.latitude, l.longitude, l.timestamp, u.name, u.role, u.phone, u.email
        FROM locations l
        JOIN users u ON l.user_id = u.id
        WHERE u.role = 'tourist'
        ORDER BY l.user_id, l.timestamp DESC
      `);
    } else {
      // Falling back to our mocked JS router join handler
      result = await db.query('SELECT l.*, u.name, u.role FROM locations l JOIN users u ON l.user_id = u.id');
    }

    res.status(200).json(result.rows);

  } catch (err) {
    console.error("Live Locations Query Error:", err);
    res.status(500).json({ error: "Server database query error." });
  }
});

module.exports = router;

const router = require('express').Router();
const db = require('../db');

router.get('/risk-score/:userId', async (req, res) => {
  const userId = parseInt(req.params.userId);

  try {
    const locResult = await db.query(
      `SELECT * FROM locations WHERE user_id = $1 ORDER BY timestamp DESC LIMIT 5`,
      [userId]
    );

    const locations = locResult.rows;

    if (locations.length === 0) {
      return res.status(200).json({
        userId,
        riskScore: 'Low',
        explanation: 'No location data recorded yet.'
      });
    }

    const latest = locations[0];
    const timeDiffMins = (new Date() - new Date(latest.timestamp)) / (1000 * 60);

    const zonesResult = await db.query('SELECT * FROM risk_zones');
    let insideHighRiskGeofence = false;
    let zoneName = '';

    function isPointInPolygon(point, polygonCoordinates) {
      const x = point[0]; 
      const y = point[1];
      let inside = false;
      for (let i = 0, j = polygonCoordinates.length - 1; i < polygonCoordinates.length; j = i++) {
        const xi = polygonCoordinates[i][0]; 
        const yi = polygonCoordinates[i][1];
        const xj = polygonCoordinates[j][0]; 
        const yj = polygonCoordinates[j][1];
        const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
      }
      return inside;
    }

    for (let zone of zonesResult.rows) {
      let geojson = zone.polygon_geojson;
      if (typeof geojson === 'string') {
        try { 
          geojson = JSON.parse(geojson); 
        } catch (e) {}
      }
      
      let coords = [];
      if (geojson.type === 'Feature') {
        coords = geojson.geometry.coordinates[0];
      } else if (geojson.type === 'Polygon') {
        coords = geojson.coordinates[0];
      } else if (geojson.coordinates) {
        coords = geojson.coordinates[0];
      } else {
        coords = geojson;
      }
      
      const isInside = isPointInPolygon([latest.longitude, latest.latitude], coords);
      if (isInside && (zone.risk_level === 'High' || zone.risk_level === 'Medium')) {
        insideHighRiskGeofence = true;
        zoneName = zone.name;
        break;
      }
    }

    // Rule 1: No update for > 5 minutes while inside a danger zone
    if (timeDiffMins > 5 && insideHighRiskGeofence) {
      return res.status(200).json({
        userId,
        riskScore: 'High',
        explanation: `Inactive for ${Math.round(timeDiffMins)} minutes in danger zone "${zoneName}".`
      });
    }

    // Rule 2: Stopped movement pattern (last 3 location points are identical)
    if (locations.length >= 3) {
      const p1 = locations[0];
      const p2 = locations[1];
      const p3 = locations[2];
      
      const isIdentical = 
        Math.abs(p1.latitude - p2.latitude) < 0.00001 &&
        Math.abs(p1.longitude - p2.longitude) < 0.00001 &&
        Math.abs(p2.latitude - p3.latitude) < 0.00001 &&
        Math.abs(p2.longitude - p3.longitude) < 0.00001;

      if (isIdentical) {
        return res.status(200).json({
          userId,
          riskScore: 'Medium',
          explanation: 'Immobility alert: Location has remained unchanged across multiple updates.'
        });
      }
    }

    // Rule 3: General inactivity for > 20 minutes
    if (timeDiffMins > 20) {
      return res.status(200).json({
        userId,
        riskScore: 'Medium',
        explanation: `No location signals received for ${Math.round(timeDiffMins)} minutes.`
      });
    }

    return res.status(200).json({
      userId,
      riskScore: 'Low',
      explanation: 'Active signals normal. Path coordinates within safe thresholds.'
    });

  } catch (err) {
    console.error("AI assessment error:", err);
    res.status(500).json({ error: "AI assessment engine failure." });
  }
});

module.exports = router;

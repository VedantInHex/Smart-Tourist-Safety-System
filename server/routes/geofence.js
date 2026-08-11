const router = require('express').Router();
const db = require('../db');

// Create a new Geofence Risk Zone
router.post('/create', async (req, res) => {
  const { name, polygon_geojson, risk_level, created_by } = req.body;

  if (!name || !polygon_geojson || !risk_level) {
    return res.status(400).json({ error: "Missing required fields: name, polygon_geojson, risk_level" });
  }

  try {
    const geojsonStr = typeof polygon_geojson === 'object' ? JSON.stringify(polygon_geojson) : polygon_geojson;
    
    const result = await db.query(
      `INSERT INTO risk_zones (name, polygon_geojson, risk_level, created_by)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [name, geojsonStr, risk_level, created_by || null]
    );

    const newZone = result.rows[0];
    newZone.polygon_geojson = JSON.parse(newZone.polygon_geojson);

    res.status(201).json({
      message: "Geofence created successfully",
      geofence: newZone
    });

  } catch (err) {
    console.error("Create Geofence Error:", err);
    res.status(500).json({ error: "Server database insert error." });
  }
});

// List all Geofences
router.get('/list', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM risk_zones');
    const list = result.rows.map(zone => {
      try {
        return {
          ...zone,
          polygon_geojson: JSON.parse(zone.polygon_geojson)
        };
      } catch (err) {
        return zone;
      }
    });

    res.status(200).json(list);

  } catch (err) {
    console.error("List Geofences Error:", err);
    res.status(500).json({ error: "Server database query error." });
  }
});

module.exports = router;

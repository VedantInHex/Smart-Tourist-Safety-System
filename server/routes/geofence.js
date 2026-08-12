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

// Delete a Geofence
router.delete('/:id', async (req, res) => {
  const geofenceId = parseInt(req.params.id);

  try {
    const result = await db.query('DELETE FROM risk_zones WHERE id = $1 RETURNING *', [geofenceId]);

    // Handle return value for mock db or real db
    if (result.rows.length === 0) {
      // For mock db delete, if it was not found, return error, but if it was deleted, it returns the id
      return res.status(404).json({ error: "Geofence not found." });
    }

    res.status(200).json({
      message: "Geofence deleted successfully",
      geofence: result.rows[0]
    });

  } catch (err) {
    console.error("Delete Geofence Error:", err);
    res.status(500).json({ error: "Server database delete error." });
  }
});

module.exports = router;

const router = require('express').Router();
const db = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');

// Create or update Trip Itinerary for logged-in tourist
router.post('/create', requireAuth, async (req, res) => {
  const { title, start_location, destination, waypoints, start_date, end_date } = req.body;

  if (!title || !start_location || !destination) {
    return res.status(400).json({ error: "Missing required fields: title, start_location, destination." });
  }

  try {
    const waypointsStr = typeof waypoints === 'object' ? JSON.stringify(waypoints) : (waypoints || '[]');
    
    // Check if user already has an active itinerary or insert new
    const existing = await db.query('SELECT * FROM itineraries WHERE user_id = $1 ORDER BY id DESC LIMIT 1', [req.user.id]);
    
    let result;
    if (existing.rows.length > 0) {
      result = await db.query(
        `UPDATE itineraries 
         SET title = $1, start_location = $2, destination = $3, waypoints = $4, start_date = $5, end_date = $6, updated_at = $7
         WHERE id = $8 RETURNING *`,
        [title, start_location, destination, waypointsStr, start_date || new Date(), end_date || null, new Date(), existing.rows[0].id]
      );
    } else {
      result = await db.query(
        `INSERT INTO itineraries (user_id, title, start_location, destination, waypoints, start_date, end_date, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
        [req.user.id, title, start_location, destination, waypointsStr, start_date || new Date(), end_date || null, new Date()]
      );
    }

    const itinerary = result.rows[0];
    try {
      itinerary.waypoints = JSON.parse(itinerary.waypoints);
    } catch (e) {}

    res.status(201).json({
      message: "Trip itinerary saved successfully",
      itinerary
    });

  } catch (err) {
    console.error("Create Itinerary Error:", err);
    res.status(500).json({ error: "Server error saving trip itinerary." });
  }
});

// Fetch itinerary for logged-in tourist
router.get('/my', requireAuth, async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM itineraries WHERE user_id = $1 ORDER BY id DESC LIMIT 1', [req.user.id]);
    if (result.rows.length === 0) {
      return res.status(200).json(null);
    }
    const itinerary = result.rows[0];
    try {
      itinerary.waypoints = JSON.parse(itinerary.waypoints);
    } catch (e) {}

    res.status(200).json(itinerary);
  } catch (err) {
    console.error("Get My Itinerary Error:", err);
    res.status(500).json({ error: "Server query error fetching itinerary." });
  }
});

// Fetch itinerary for any user (Admin or authorized)
router.get('/user/:userId', requireAuth, async (req, res) => {
  const targetId = parseInt(req.params.userId);

  if (req.user.role !== 'admin' && req.user.id !== targetId) {
    return res.status(403).json({ error: "Access denied. Can only view your own itinerary." });
  }

  try {
    const result = await db.query('SELECT * FROM itineraries WHERE user_id = $1 ORDER BY id DESC LIMIT 1', [targetId]);
    if (result.rows.length === 0) {
      return res.status(200).json(null);
    }
    const itinerary = result.rows[0];
    try {
      itinerary.waypoints = JSON.parse(itinerary.waypoints);
    } catch (e) {}

    res.status(200).json(itinerary);
  } catch (err) {
    console.error("Get User Itinerary Error:", err);
    res.status(500).json({ error: "Server query error fetching itinerary." });
  }
});

module.exports = router;

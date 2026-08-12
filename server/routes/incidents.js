const router = require('express').Router();
const db = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');

// Create SOS Incident
router.post('/sos', requireAuth, async (req, res) => {
  const { user_id, latitude, longitude } = req.body;

  if (!user_id || latitude === undefined || longitude === undefined) {
    return res.status(400).json({ error: "Missing required fields: user_id, latitude, longitude" });
  }

  // Ensure tourists can only raise SOS for themselves
  if (req.user.role !== 'admin' && req.user.id !== parseInt(user_id)) {
    return res.status(403).json({ error: "Access denied. Can only trigger SOS for yourself." });
  }

  try {
    // 1. Insert incident record
    const incResult = await db.query(
      `INSERT INTO incidents (user_id, type, latitude, longitude, status, ai_risk_score, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [user_id, 'sos', latitude, longitude, 'Open', 'Critical', new Date()]
    );

    const newIncident = incResult.rows[0];

    // 2. Log an alert
    const alertMsg = `EMERGENCY SOS: User raised panic signal! Geolocation: (${latitude}, ${longitude})`;
    await db.query(
      `INSERT INTO alerts (user_id, incident_id, message, sent_at)
       VALUES ($1, $2, $3, $4)`,
      [user_id, newIncident.id, alertMsg, new Date()]
    );

    res.status(201).json({
      message: "SOS incident created successfully",
      incident: newIncident
    });

  } catch (err) {
    console.error("SOS Incident Error:", err);
    res.status(500).json({ error: "Server database insert error." });
  }
});

// List all Incidents
router.get('/', requireAuth, requireAdmin, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT i.*, u.name as user_name, u.phone as user_phone
       FROM incidents i
       JOIN users u ON i.user_id = u.id
       ORDER BY i.created_at DESC`
    );
    res.status(200).json(result.rows);
  } catch (err) {
    console.error("List Incidents Error:", err);
    res.status(500).json({ error: "Server database query error." });
  }
});

// Update Incident Status
router.patch('/:id/status', requireAuth, requireAdmin, async (req, res) => {
  const incidentId = parseInt(req.params.id);
  const { status } = req.body;

  if (!status) {
    return res.status(400).json({ error: "Status field is required." });
  }

  try {
    const resolvedAt = status === 'Resolved' ? new Date() : null;

    const result = await db.query(
      `UPDATE incidents 
       SET status = $1, resolved_at = $2 
       WHERE id = $3 RETURNING *`,
      [status, resolvedAt, incidentId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Incident not found." });
    }

    const updatedIncident = result.rows[0];

    // Create notification alert for user
    const alertMsg = `Your incident status was updated to: ${status}`;
    await db.query(
      `INSERT INTO alerts (user_id, incident_id, message, sent_at)
       VALUES ($1, $2, $3, $4)`,
      [updatedIncident.user_id, updatedIncident.id, alertMsg, new Date()]
    );

    res.status(200).json({
      message: "Incident status updated",
      incident: updatedIncident
    });

  } catch (err) {
    console.error("Update Incident Error:", err);
    res.status(500).json({ error: "Server update incident error." });
  }
});

// Fetch incidents for the logged-in tourist
router.get('/my', requireAuth, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT * FROM incidents WHERE user_id = $1 ORDER BY created_at DESC`,
      [req.user.id]
    );
    res.status(200).json(result.rows);
  } catch (err) {
    console.error("My Incidents Error:", err);
    res.status(500).json({ error: "Server query error." });
  }
});

// Fetch alerts for a user
router.get('/alerts/:userId', requireAuth, async (req, res) => {
  const userId = parseInt(req.params.userId);

  // Ensure tourists can only view their own alerts
  if (req.user.role !== 'admin' && req.user.id !== userId) {
    return res.status(403).json({ error: "Access denied. Can only view your own alerts." });
  }
  try {
    const result = await db.query(
      `SELECT * FROM alerts WHERE user_id = $1 ORDER BY sent_at DESC`,
      [userId]
    );
    res.status(200).json(result.rows);
  } catch (err) {
    console.error("Get Alerts Error:", err);
    res.status(500).json({ error: "Server query error." });
  }
});

module.exports = router;

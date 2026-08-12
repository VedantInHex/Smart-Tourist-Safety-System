const router = require('express').Router();
const db = require('../db');
const QRCode = require('qrcode');
const { verifyChain } = require('../blockchain');
const { requireAuth, requireAdmin } = require('../middleware/auth');

// Get Digital ID details
router.get('/:userId', requireAuth, async (req, res) => {
  const userId = parseInt(req.params.userId);

  if (req.user.role !== 'admin' && req.user.id !== userId) {
    return res.status(403).json({ error: "Access denied. Can only view your own Digital ID." });
  }

  try {
    const userResult = await db.query('SELECT * FROM users WHERE id = $1', [userId]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: "User not found." });
    }
    const user = userResult.rows[0];
    delete user.password;

    const blockResult = await db.query('SELECT * FROM digital_ids WHERE user_id = $1', [userId]);
    if (blockResult.rows.length === 0) {
      return res.status(404).json({ error: "Digital ID record not found for this user." });
    }
    const block = blockResult.rows[0];

    const qrPayload = JSON.stringify({
      userId: user.id,
      hash: block.id_hash,
      name: user.name,
      email: user.email,
      phone: user.phone,
      emergency: user.emergency_contact
    });
    const qrCode = await QRCode.toDataURL(qrPayload);

    res.status(200).json({
      user,
      digitalId: block,
      qrCode
    });

  } catch (err) {
    console.error("Get Digital ID Error:", err);
    res.status(500).json({ error: "Server database query error." });
  }
});

// Verify Blockchain integrity
router.get('/chain/verify', requireAuth, requireAdmin, async (req, res) => {
  try {
    // Select all blocks ordered by id
    const blocksResult = await db.query('SELECT * FROM digital_ids ORDER BY id ASC');
    // Select all users who are tourists
    const usersResult = await db.query("SELECT * FROM users WHERE role = 'tourist'");

    const blocks = blocksResult.rows;
    const users = usersResult.rows;

    const verificationResult = verifyChain(blocks, users);

    res.status(200).json(verificationResult);

  } catch (err) {
    console.error("Verify Chain Error:", err);
    res.status(500).json({ error: "Server blockchain verification error." });
  }
});

const { calculateHash } = require('../blockchain');

// Verify single Digital ID QR payload
router.post('/verify', requireAuth, requireAdmin, async (req, res) => {
  const { userId, hash } = req.body;

  if (!userId || !hash) {
    return res.status(400).json({ error: "Missing required verification fields: userId and hash." });
  }

  try {
    // 1. Fetch user from DB
    const userResult = await db.query('SELECT * FROM users WHERE id = $1', [userId]);
    if (userResult.rows.length === 0) {
      return res.status(200).json({
        verified: false,
        error: `User not found in system directory.`
      });
    }
    const user = userResult.rows[0];

    // 2. Fetch block from DB
    const blockResult = await db.query('SELECT * FROM digital_ids WHERE user_id = $1', [userId]);
    if (blockResult.rows.length === 0) {
      return res.status(200).json({
        verified: false,
        error: `No Digital ID block registered for this user.`
      });
    }
    const block = blockResult.rows[0];

    // 3. Check QR hash against stored DB block hash
    if (block.id_hash !== hash) {
      return res.status(200).json({
        verified: false,
        error: `Tamper Warning: The QR ID hash does not match the blockchain registry.`,
        storedHash: block.id_hash,
        providedHash: hash
      });
    }

    // 4. Recalculate block hash to check database record integrity
    const recalculated = calculateHash(
      {
        id: user.id,
        name: user.name,
        email: user.email,
        id_proof_number: user.id_proof_number
      },
      block.issued_at,
      block.valid_until,
      block.previous_hash
    );

    if (block.id_hash !== recalculated) {
      return res.status(200).json({
        verified: false,
        error: `Database Integrity Failure: The stored user details do not match the blockchain signature. (DB Tampered)`,
        storedHash: block.id_hash,
        recalculatedHash: recalculated
      });
    }

    // 5. Successful validation
    res.status(200).json({
      verified: true,
      message: "Digital ID successfully authenticated.",
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        id_proof_number: user.id_proof_number,
        emergency_contact: user.emergency_contact
      },
      valid_until: block.valid_until
    });

  } catch (err) {
    console.error("Single Verify Error:", err);
    res.status(500).json({ error: "Server verification processing error." });
  }
});

module.exports = router;


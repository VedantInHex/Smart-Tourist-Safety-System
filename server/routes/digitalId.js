const router = require('express').Router();
const db = require('../db');
const QRCode = require('qrcode');
const { verifyChain } = require('../blockchain');

// Get Digital ID details
router.get('/:userId', async (req, res) => {
  const userId = parseInt(req.params.userId);

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
router.get('/chain/verify', async (req, res) => {
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

module.exports = router;

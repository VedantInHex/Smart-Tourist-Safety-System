const router = require('express').Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const QRCode = require('qrcode');
const db = require('../db');
const { calculateHash, GENESIS_HASH } = require('../blockchain');

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretjwtkey';

// Register User (Tourist / Admin)
router.post('/register', async (req, res) => {
  const { name, id_proof_number, phone, email, emergency_contact, role, password } = req.body;

  if (!name || !id_proof_number || !phone || !email || !emergency_contact || !password) {
    return res.status(400).json({ error: "Missing required registration fields." });
  }

  try {
    // Check if user exists
    const checkUser = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    if (checkUser.rows.length > 0) {
      return res.status(400).json({ error: "Email already registered." });
    }

    // Hash Password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Save User
    const userRole = role || 'tourist';
    const insertUser = await db.query(
      `INSERT INTO users (name, id_proof_number, phone, email, emergency_contact, role, password)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [name, id_proof_number, phone, email, emergency_contact, userRole, hashedPassword]
    );

    const newUser = insertUser.rows[0];
    delete newUser.password;

    // Generate Blockchain digital ID if tourist
    let qrCode = null;
    let newBlock = null;

    if (userRole === 'tourist') {
      // Get previous block hash
      const getPrevBlock = await db.query('SELECT * FROM digital_ids ORDER BY id DESC LIMIT 1');
      const prevHash = getPrevBlock.rows.length > 0 ? getPrevBlock.rows[0].id_hash : GENESIS_HASH;

      const issuedAt = new Date();
      const validUntil = new Date();
      validUntil.setFullYear(validUntil.getFullYear() + 1); // 1 year validity

      const idHash = calculateHash(
        {
          id: newUser.id,
          name: newUser.name,
          email: newUser.email,
          id_proof_number: newUser.id_proof_number
        },
        issuedAt,
        validUntil,
        prevHash
      );

      // Save Block
      const insertBlock = await db.query(
        `INSERT INTO digital_ids (user_id, id_hash, previous_hash, issued_at, valid_until)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [newUser.id, idHash, prevHash, issuedAt, validUntil]
      );
      newBlock = insertBlock.rows[0];

      // Generate QR Code containing the digital ID info
      const qrPayload = JSON.stringify({
        userId: newUser.id,
        hash: idHash,
        name: newUser.name,
        email: newUser.email,
        phone: newUser.phone,
        emergency: newUser.emergency_contact
      });
      qrCode = await QRCode.toDataURL(qrPayload);
    }

    // Generate JWT Token
    const token = jwt.sign({ id: newUser.id, role: newUser.role }, JWT_SECRET, { expiresIn: '24h' });

    res.status(201).json({
      message: "Registration successful",
      user: newUser,
      token,
      digitalId: newBlock,
      qrCode
    });

  } catch (err) {
    console.error("Register Error:", err);
    res.status(500).json({ error: "Server registration error." });
  }
});

// Login User
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required." });
  }

  try {
    const checkUser = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    if (checkUser.rows.length === 0) {
      return res.status(400).json({ error: "Invalid email or password." });
    }

    const user = checkUser.rows[0];
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(400).json({ error: "Invalid email or password." });
    }

    delete user.password;

    // Fetch Digital ID details if tourist
    let digitalId = null;
    let qrCode = null;
    if (user.role === 'tourist') {
      const getBlock = await db.query('SELECT * FROM digital_ids WHERE user_id = $1', [user.id]);
      if (getBlock.rows.length > 0) {
        digitalId = getBlock.rows[0];
        const qrPayload = JSON.stringify({
          userId: user.id,
          hash: digitalId.id_hash,
          name: user.name,
          email: user.email,
          phone: user.phone,
          emergency: user.emergency_contact
        });
        qrCode = await QRCode.toDataURL(qrPayload);
      }
    }

    // Generate JWT Token
    const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '24h' });

    res.status(200).json({
      message: "Login successful",
      user,
      token,
      digitalId,
      qrCode
    });

  } catch (err) {
    console.error("Login Error:", err);
    res.status(500).json({ error: "Server login error." });
  }
});

module.exports = router;

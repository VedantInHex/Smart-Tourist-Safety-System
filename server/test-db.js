const { Pool } = require("pg");
require("dotenv").config();

const pool = new Pool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT,
  ssl: { rejectUnauthorized: false },
});

pool.query("SELECT NOW()", (err, res) => {
  if (err) {
    console.error("❌ Connection failed:", err.message);
  } else {
    console.log("✅ Connected! Server time:", res.rows[0].now);
  }
  pool.end();
});

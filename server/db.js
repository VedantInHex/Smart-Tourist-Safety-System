const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

let usePostgres = false;
let pool = null;

const DB_FILE = path.join(__dirname, 'mock_db.json');
let localDb = {
  users: [],
  digital_ids: [],
  locations: [],
  risk_zones: [],
  incidents: [],
  alerts: []
};

function loadLocalDb() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const data = fs.readFileSync(DB_FILE, 'utf8');
      localDb = JSON.parse(data);
    }
  } catch (err) {
    console.error("Failed to load local DB file:", err);
  }
}

function saveLocalDb() {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(localDb, null, 2), 'utf8');
  } catch (err) {
    console.error("Failed to save local DB file:", err);
  }
}

function seedLocalDb() {
  if (localDb.users.length === 0) {
    console.log("Seeding mock database...");
    const bcrypt = require('bcrypt');
    const crypto = require('crypto');

    const adminPassword = bcrypt.hashSync('admin123', 10);
    const touristPassword = bcrypt.hashSync('tourist123', 10);

    const admin = {
      id: 1,
      name: "Cmdr. Alice Miller",
      id_proof_number: "ADM-99801",
      phone: "+41 22 730 0111",
      email: "admin@safetour.com",
      emergency_contact: "Internal Dispatch",
      role: "admin",
      password: adminPassword,
      created_at: new Date()
    };

    const tourist = {
      id: 2,
      name: "Marcus Aurelius",
      id_proof_number: "PASSPORT-XM889",
      phone: "+39 06 6982",
      email: "tourist@safetour.com",
      emergency_contact: "Sophia Aurelius (+39 06 6983)",
      role: "tourist",
      password: touristPassword,
      created_at: new Date()
    };

    localDb.users.push(admin, tourist);

    const geofence = {
      id: 1,
      name: "Geneva Lake Jetty Hazard Zone",
      polygon_geojson: JSON.stringify({
        type: "Polygon",
        coordinates: [[
          [6.151, 46.210],
          [6.158, 46.210],
          [6.158, 46.205],
          [6.151, 46.205],
          [6.151, 46.210]
        ]]
      }),
      risk_level: "High",
      created_by: 1
    };
    localDb.risk_zones.push(geofence);

    const loc = {
      id: 1,
      user_id: 2,
      latitude: 46.2023,
      longitude: 6.1432,
      timestamp: new Date()
    };
    localDb.locations.push(loc);

    const incident = {
      id: 1,
      user_id: 2,
      type: "geofence",
      latitude: 46.208,
      longitude: 6.153,
      status: "Resolved",
      ai_risk_score: "High",
      created_at: new Date(Date.now() - 3600000),
      resolved_at: new Date(Date.now() - 1800000)
    };
    localDb.incidents.push(incident);

    const alert = {
      id: 1,
      user_id: 2,
      incident_id: 1,
      message: "User entered danger geofence zone: \"Geneva Lake Jetty Hazard Zone\" (High Risk)",
      sent_at: new Date(Date.now() - 3600000)
    };
    localDb.alerts.push(alert);

    const GENESIS_HASH = "0000000000000000000000000000000000000000000000000000000000000000";
    const issuedAt = new Date();
    const validUntil = new Date();
    validUntil.setFullYear(validUntil.getFullYear() + 1);

    const dataStr = JSON.stringify({
      userId: tourist.id,
      name: tourist.name,
      email: tourist.email,
      idProof: tourist.id_proof_number
    });
    
    const payload = `${dataStr}_${issuedAt.toISOString()}_${validUntil.toISOString()}_${GENESIS_HASH}`;
    const idHash = crypto.createHash('sha256').update(payload).digest('hex');

    const block = {
      id: 1,
      user_id: 2,
      id_hash: idHash,
      previous_hash: GENESIS_HASH,
      issued_at: issuedAt,
      valid_until: validUntil
    };
    localDb.digital_ids.push(block);

    saveLocalDb();
  }
}

loadLocalDb();
seedLocalDb();

async function initDb() {
  if (process.env.DB_HOST && process.env.DB_USER) {
    console.log("PostgreSQL configuration found. Attempting connection...");
    pool = new Pool({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASS,
      database: process.env.DB_NAME,
      port: parseInt(process.env.DB_PORT) || 5432,
      connectionTimeoutMillis: 3000
    });

    try {
      const client = await pool.connect();
      client.release();
      usePostgres = true;
      console.log("Successfully connected to PostgreSQL Database!");
      await runMigrations();
    } catch (err) {
      console.warn("PostgreSQL connection failed. Falling back to simulated in-memory/JSON database.", err.message);
      usePostgres = false;
    }
  } else {
    console.log("No PostgreSQL config found. Defaulting to simulated in-memory/JSON database.");
    usePostgres = false;
  }
}

async function runMigrations() {
  const queries = [
    `CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      id_proof_number VARCHAR(100) NOT NULL,
      phone VARCHAR(50) NOT NULL,
      email VARCHAR(100) UNIQUE NOT NULL,
      emergency_contact VARCHAR(100) NOT NULL,
      role VARCHAR(20) NOT NULL DEFAULT 'tourist',
      password VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );`,
    `CREATE TABLE IF NOT EXISTS digital_ids (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      id_hash VARCHAR(64) NOT NULL,
      previous_hash VARCHAR(64) NOT NULL,
      issued_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      valid_until TIMESTAMP NOT NULL
    );`,
    `CREATE TABLE IF NOT EXISTS locations (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      latitude DOUBLE PRECISION NOT NULL,
      longitude DOUBLE PRECISION NOT NULL,
      timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );`,
    `CREATE TABLE IF NOT EXISTS risk_zones (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      polygon_geojson TEXT NOT NULL,
      risk_level VARCHAR(20) NOT NULL,
      created_by INTEGER REFERENCES users(id)
    );`,
    `CREATE TABLE IF NOT EXISTS incidents (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      type VARCHAR(50) NOT NULL,
      latitude DOUBLE PRECISION NOT NULL,
      longitude DOUBLE PRECISION NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'Open',
      ai_risk_score VARCHAR(20) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      resolved_at TIMESTAMP
    );`,
    `CREATE TABLE IF NOT EXISTS alerts (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      incident_id INTEGER REFERENCES incidents(id) ON DELETE CASCADE,
      message TEXT NOT NULL,
      sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );`
  ];

  for (let q of queries) {
    await pool.query(q);
  }
}

async function mockQuery(sql, params = []) {
  const cleanSql = sql.replace(/\s+/g, ' ').trim().toLowerCase();

  if (cleanSql.includes('select * from users where email =')) {
    const email = params[0];
    const user = localDb.users.find(u => u.email === email);
    return { rows: user ? [{ ...user }] : [] };
  }

  if (cleanSql.startsWith('insert into users')) {
    const newUser = {
      id: localDb.users.length + 1,
      name: params[0],
      id_proof_number: params[1],
      phone: params[2],
      email: params[3],
      emergency_contact: params[4],
      role: params[5] || 'tourist',
      password: params[6],
      created_at: new Date()
    };
    localDb.users.push(newUser);
    saveLocalDb();
    return { rows: [{ ...newUser }] };
  }

  if (cleanSql.includes('select * from users where id =')) {
    const id = parseInt(params[0]);
    const user = localDb.users.find(u => u.id === id);
    return { rows: user ? [{ ...user }] : [] };
  }

  if (cleanSql.startsWith('insert into digital_ids')) {
    const newId = {
      id: localDb.digital_ids.length + 1,
      user_id: parseInt(params[0]),
      id_hash: params[1],
      previous_hash: params[2],
      issued_at: params[3] || new Date(),
      valid_until: params[4]
    };
    localDb.digital_ids.push(newId);
    saveLocalDb();
    return { rows: [newId] };
  }

  if (cleanSql.includes('select * from digital_ids where user_id =')) {
    const userId = parseInt(params[0]);
    const dId = localDb.digital_ids.find(d => d.user_id === userId);
    return { rows: dId ? [dId] : [] };
  }

  if (cleanSql.includes('select * from digital_ids') && (cleanSql.includes('order by') || cleanSql.length < 40)) {
    const sorted = [...localDb.digital_ids].sort((a, b) => a.id - b.id);
    return { rows: sorted };
  }

  if (cleanSql.startsWith('insert into locations')) {
    const newLoc = {
      id: localDb.locations.length + 1,
      user_id: parseInt(params[0]),
      latitude: parseFloat(params[1]),
      longitude: parseFloat(params[2]),
      timestamp: params[3] || new Date()
    };
    localDb.locations.push(newLoc);
    saveLocalDb();
    return { rows: [newLoc] };
  }

  if (cleanSql.includes('locations') && cleanSql.includes('users') && cleanSql.includes('join')) {
    const latestLocations = [];
    localDb.users.forEach(user => {
      const userLocs = localDb.locations.filter(l => l.user_id === user.id);
      if (userLocs.length > 0) {
        userLocs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp) || b.id - a.id);
        const latest = userLocs[0];
        latestLocations.push({
          ...latest,
          name: user.name,
          role: user.role,
          email: user.email,
          phone: user.phone
        });
      }
    });
    return { rows: latestLocations };
  }

  if (cleanSql.startsWith('insert into risk_zones')) {
    const newZone = {
      id: localDb.risk_zones.length + 1,
      name: params[0],
      polygon_geojson: params[1],
      risk_level: params[2],
      created_by: params[3] ? parseInt(params[3]) : null
    };
    localDb.risk_zones.push(newZone);
    saveLocalDb();
    return { rows: [newZone] };
  }

  if (cleanSql.includes('select * from risk_zones')) {
    return { rows: localDb.risk_zones };
  }

  if (cleanSql.startsWith('delete from risk_zones')) {
    const id = parseInt(params[0]);
    const idx = localDb.risk_zones.findIndex(z => z.id === id);
    if (idx !== -1) {
      localDb.risk_zones.splice(idx, 1);
      saveLocalDb();
      return { rows: [{ id }] };
    }
    return { rows: [] };
  }

  if (cleanSql.startsWith('insert into incidents')) {
    const newIncident = {
      id: localDb.incidents.length + 1,
      user_id: parseInt(params[0]),
      type: params[1],
      latitude: parseFloat(params[2]),
      longitude: parseFloat(params[3]),
      status: params[4] || 'Open',
      ai_risk_score: params[5],
      created_at: params[6] || new Date(),
      resolved_at: null
    };
    localDb.incidents.push(newIncident);
    saveLocalDb();
    return { rows: [newIncident] };
  }

  if (cleanSql.includes('select * from incidents where user_id =') && !cleanSql.includes('join')) {
    const userId = parseInt(params[0]);
    const list = localDb.incidents.filter(inc => inc.user_id === userId);
    list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at) || b.id - a.id);
    return { rows: list };
  }

  if (cleanSql.includes('incidents') && cleanSql.includes('users') && cleanSql.includes('join')) {
    const list = localDb.incidents.map(inc => {
      const u = localDb.users.find(usr => usr.id === inc.user_id);
      return {
        ...inc,
        name: u ? u.name : 'Unknown User'
      };
    });
    list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at) || b.id - a.id);
    return { rows: list };
  }

  if (cleanSql.startsWith('update incidents')) {
    const status = params[0];
    const resolvedAt = params[1];
    const notes = params[2];
    const id = parseInt(params[3]);
    const idx = localDb.incidents.findIndex(inc => inc.id === id);
    if (idx !== -1) {
      localDb.incidents[idx].status = status;
      localDb.incidents[idx].resolved_at = resolvedAt;
      if (notes !== undefined) {
        localDb.incidents[idx].notes = notes;
      }
      saveLocalDb();
      return { rows: [localDb.incidents[idx]] };
    }
    return { rows: [] };
  }

  if (cleanSql.startsWith('insert into alerts')) {
    const newAlert = {
      id: localDb.alerts.length + 1,
      user_id: parseInt(params[0]),
      incident_id: params[1] ? parseInt(params[1]) : null,
      message: params[2],
      sent_at: params[3] || new Date()
    };
    localDb.alerts.push(newAlert);
    saveLocalDb();
    return { rows: [newAlert] };
  }

  if (cleanSql.includes('select * from alerts where user_id =')) {
    const userId = parseInt(params[0]);
    const list = localDb.alerts.filter(a => a.user_id === userId);
    list.sort((a, b) => new Date(b.sent_at) - new Date(a.sent_at) || b.id - a.id);
    return { rows: list };
  }

  console.warn("Mock DB unhandled query:", cleanSql);
  return { rows: [] };
}

async function query(sqlText, params = []) {
  if (usePostgres) {
    return pool.query(sqlText, params);
  } else {
    return mockQuery(sqlText, params);
  }
}

let originalUserData = {};

async function tamperUser(userId) {
  if (usePostgres) {
    const res = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
    if (res.rows.length > 0) {
      const user = res.rows[0];
      originalUserData[userId] = { name: user.name, id_proof_number: user.id_proof_number };
      await pool.query("UPDATE users SET name = $1, id_proof_number = $2 WHERE id = $3", [user.name + " (Tampered)", "COMPROMISED-999", userId]);
    }
  } else {
    const user = localDb.users.find(u => u.id === userId);
    if (user) {
      originalUserData[userId] = { name: user.name, id_proof_number: user.id_proof_number };
      user.name = user.name + " (Tampered)";
      user.id_proof_number = "COMPROMISED-999";
      saveLocalDb();
    }
  }
}

async function restoreUser(userId) {
  const original = originalUserData[userId] || { name: "Marcus Aurelius", id_proof_number: "PASSPORT-XM889" };
  if (usePostgres) {
    await pool.query("UPDATE users SET name = $1, id_proof_number = $2 WHERE id = $3", [original.name, original.id_proof_number, userId]);
  } else {
    const user = localDb.users.find(u => u.id === userId);
    if (user) {
      user.name = original.name;
      user.id_proof_number = original.id_proof_number;
      saveLocalDb();
    }
  }
}

module.exports = {
  initDb,
  query,
  isPostgres: () => usePostgres,
  localDb,
  tamperUser,
  restoreUser
};

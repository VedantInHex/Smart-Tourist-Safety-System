const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

let usePostgres = false;
let pool = null;

const DB_FILE = path.join(__dirname, 'mock_db.json');
let localDb = {
  users: [],
  digital_ids: [],
  locations: [],
  risk_zones: [],
  incidents: [],
  alerts: [],
  itineraries: []
};

// Standard predefined hazard zones across India & International
const DEFAULT_RISK_ZONES = [
  {
    name: "Goa Baga Beach High-Tide & Rip Current Zone (Goa, India)",
    polygon_geojson: JSON.stringify({
      type: "Polygon",
      coordinates: [[
        [73.7450, 15.5600],
        [73.7600, 15.5600],
        [73.7600, 15.5450],
        [73.7450, 15.5450],
        [73.7450, 15.5600]
      ]]
    }),
    risk_level: "High"
  },
  {
    name: "Rohtang Pass Avalanche & Landslide Danger Area (Manali, India)",
    polygon_geojson: JSON.stringify({
      type: "Polygon",
      coordinates: [[
        [77.2300, 32.3850],
        [77.2600, 32.3850],
        [77.2600, 32.3600],
        [77.2300, 32.3600],
        [77.2300, 32.3850]
      ]]
    }),
    risk_level: "High"
  },
  {
    name: "Connaught Place Red Zone High-Congestion Safety Perimeter (New Delhi, India)",
    polygon_geojson: JSON.stringify({
      type: "Polygon",
      coordinates: [[
        [77.2100, 28.6380],
        [77.2250, 28.6380],
        [77.2250, 28.6250],
        [77.2100, 28.6250],
        [77.2100, 28.6380]
      ]]
    }),
    risk_level: "Medium"
  },
  {
    name: "Geneva Lake Jetty Hazard Zone (Geneva, Switzerland)",
    polygon_geojson: JSON.stringify({
      type: "Polygon",
      coordinates: [[
        [6.1510, 46.2100],
        [6.1580, 46.2100],
        [6.1580, 46.2050],
        [6.1510, 46.2050],
        [6.1510, 46.2100]
      ]]
    }),
    risk_level: "High"
  }
];

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
    const adminPassword = bcrypt.hashSync('admin123', 10);
    const touristPassword = bcrypt.hashSync('tourist123', 10);

    const admin = {
      id: 1,
      name: "Cmdr. Alice Miller",
      id_proof_number: "ADM-99801",
      phone: "+91 98765 43210",
      email: "admin@safetour.com",
      emergency_contact: "Search & Rescue National Command",
      role: "admin",
      password: adminPassword,
      created_at: new Date()
    };

    const tourist = {
      id: 2,
      name: "Marcus Aurelius",
      id_proof_number: "PASSPORT-XM889",
      phone: "+91 98111 22334",
      email: "tourist@safetour.com",
      emergency_contact: "Sophia Aurelius (+91 98111 22335)",
      role: "tourist",
      password: touristPassword,
      created_at: new Date()
    };

    localDb.users.push(admin, tourist);

    // Seed default risk zones
    DEFAULT_RISK_ZONES.forEach((zone, idx) => {
      localDb.risk_zones.push({
        id: idx + 1,
        name: zone.name,
        polygon_geojson: zone.polygon_geojson,
        risk_level: zone.risk_level,
        created_by: 1
      });
    });

    const loc = {
      id: 1,
      user_id: 2,
      latitude: 28.6139,
      longitude: 77.2090,
      timestamp: new Date()
    };
    localDb.locations.push(loc);

    const incident = {
      id: 1,
      user_id: 2,
      type: "geofence",
      latitude: 28.6300,
      longitude: 77.2180,
      status: "Resolved",
      ai_risk_score: "Medium",
      notes: "Tourist verified safe outside perimeter.",
      created_at: new Date(Date.now() - 3600000),
      resolved_at: new Date(Date.now() - 1800000)
    };
    localDb.incidents.push(incident);

    const alert = {
      id: 1,
      user_id: 2,
      incident_id: 1,
      message: "User entered safety zone: \"Connaught Place Red Zone High-Congestion Safety Perimeter\" (Medium Risk)",
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

    const itinerary = {
      id: 1,
      user_id: 2,
      title: "Delhi Heritage & Safety Exploration Route",
      start_location: "India Gate Central Circle",
      destination: "Connaught Place Inner Circle",
      waypoints: JSON.stringify([
        [77.2295, 28.6129],
        [77.2200, 28.6250],
        [77.2167, 28.6328]
      ]),
      start_date: new Date(),
      end_date: new Date(Date.now() + 7 * 86400000),
      created_at: new Date()
    };
    if (!localDb.itineraries) localDb.itineraries = [];
    localDb.itineraries.push(itinerary);

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
      connectionTimeoutMillis: 5000
    });

    try {
      const client = await pool.connect();
      client.release();
      usePostgres = true;
      console.log("Successfully connected to PostgreSQL Database!");
      await runMigrations();
      await seedPostgresDb();
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
      name VARCHAR(150) NOT NULL,
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
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      resolved_at TIMESTAMP
    );`,
    `ALTER TABLE incidents ADD COLUMN IF NOT EXISTS notes TEXT;`,
    `CREATE TABLE IF NOT EXISTS alerts (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      incident_id INTEGER REFERENCES incidents(id) ON DELETE CASCADE,
      message TEXT NOT NULL,
      sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );`,
    `CREATE TABLE IF NOT EXISTS itineraries (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      title VARCHAR(150) NOT NULL,
      start_location VARCHAR(150) NOT NULL,
      destination VARCHAR(150) NOT NULL,
      waypoints TEXT,
      start_date TIMESTAMP,
      end_date TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP
    );`
  ];

  for (let q of queries) {
    try {
      await pool.query(q);
    } catch (e) {
      console.warn("Migration warning for query:", q.slice(0, 40), e.message);
    }
  }
}

async function seedPostgresDb() {
  try {
    const adminRes = await pool.query("SELECT * FROM users WHERE email = 'admin@safetour.com'");
    let adminId = null;
    if (adminRes.rows.length === 0) {
      const adminPass = bcrypt.hashSync('admin123', 10);
      const insertedAdmin = await pool.query(
        `INSERT INTO users (name, id_proof_number, phone, email, emergency_contact, role, password)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
        ["Cmdr. Alice Miller", "ADM-99801", "+91 98765 43210", "admin@safetour.com", "Search & Rescue National Command", "admin", adminPass]
      );
      adminId = insertedAdmin.rows[0].id;
    } else {
      adminId = adminRes.rows[0].id;
    }

    const touristRes = await pool.query("SELECT * FROM users WHERE email = 'tourist@safetour.com'");
    let touristId = null;
    if (touristRes.rows.length === 0) {
      const touristPass = bcrypt.hashSync('tourist123', 10);
      const insertedTourist = await pool.query(
        `INSERT INTO users (name, id_proof_number, phone, email, emergency_contact, role, password)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, name, email, id_proof_number`,
        ["Marcus Aurelius", "PASSPORT-XM889", "+91 98111 22334", "tourist@safetour.com", "Sophia Aurelius (+91 98111 22335)", "tourist", touristPass]
      );
      const tUser = insertedTourist.rows[0];
      touristId = tUser.id;

      // Seed digital ID
      const GENESIS_HASH = "0000000000000000000000000000000000000000000000000000000000000000";
      const issuedAt = new Date();
      const validUntil = new Date();
      validUntil.setFullYear(validUntil.getFullYear() + 1);

      const dataStr = JSON.stringify({
        userId: tUser.id,
        name: tUser.name,
        email: tUser.email,
        idProof: tUser.id_proof_number
      });
      
      const payload = `${dataStr}_${issuedAt.toISOString()}_${validUntil.toISOString()}_${GENESIS_HASH}`;
      const idHash = crypto.createHash('sha256').update(payload).digest('hex');

      await pool.query(
        `INSERT INTO digital_ids (user_id, id_hash, previous_hash, issued_at, valid_until)
         VALUES ($1, $2, $3, $4, $5)`,
        [tUser.id, idHash, GENESIS_HASH, issuedAt, validUntil]
      );

      // Seed default location
      await pool.query(
        `INSERT INTO locations (user_id, latitude, longitude, timestamp)
         VALUES ($1, $2, $3, $4)`,
        [tUser.id, 28.6139, 77.2090, new Date()]
      );
    } else {
      touristId = touristRes.rows[0].id;
    }

    // Seed risk zones if none exist
    const zonesCheck = await pool.query('SELECT count(*) FROM risk_zones');
    if (parseInt(zonesCheck.rows[0].count) === 0) {
      for (let rz of DEFAULT_RISK_ZONES) {
        await pool.query(
          `INSERT INTO risk_zones (name, polygon_geojson, risk_level, created_by)
           VALUES ($1, $2, $3, $4)`,
          [rz.name, rz.polygon_geojson, rz.risk_level, adminId]
        );
      }
    }

    // Ensure all existing blocks form an unbroken SHA-256 chain
    const blocksRes = await pool.query('SELECT * FROM digital_ids ORDER BY id ASC');
    const usersRes = await pool.query("SELECT * FROM users WHERE role = 'tourist'");
    const GENESIS_HASH = "0000000000000000000000000000000000000000000000000000000000000000";

    let lastHash = GENESIS_HASH;
    for (let i = 0; i < blocksRes.rows.length; i++) {
      const b = blocksRes.rows[i];
      const u = usersRes.rows.find(user => user.id === b.user_id);
      if (!u) continue;

      const dataStr = JSON.stringify({
        userId: u.id,
        name: u.name,
        email: u.email,
        idProof: u.id_proof_number
      });
      const payload = `${dataStr}_${new Date(b.issued_at).toISOString()}_${new Date(b.valid_until).toISOString()}_${lastHash}`;
      const correctHash = crypto.createHash('sha256').update(payload).digest('hex');

      if (b.previous_hash !== lastHash || b.id_hash !== correctHash) {
        await pool.query(
          'UPDATE digital_ids SET previous_hash = $1, id_hash = $2 WHERE id = $3',
          [lastHash, correctHash, b.id]
        );
      }
      lastHash = correctHash;
    }
  } catch (err) {
    console.error("Postgres Seeding Error:", err);
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

  if (cleanSql.includes("select * from users where role")) {
    const match = cleanSql.match(/role\s*=\s*'([^']+)'/);
    const role = match ? match[1] : params[0];
    const filtered = localDb.users.filter(u => u.role === role);
    return { rows: filtered.map(u => ({ ...u })) };
  }

  if (cleanSql.includes("select * from users")) {
    return { rows: localDb.users.map(u => ({ ...u })) };
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

  if (cleanSql.includes('select * from locations where user_id =')) {
    const userId = parseInt(params[0]);
    const userLocs = localDb.locations.filter(l => l.user_id === userId);
    userLocs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp) || b.id - a.id);
    return { rows: userLocs.slice(0, 5) };
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
        user_name: u ? u.name : 'Unknown User',
        user_phone: u ? u.phone : 'N/A',
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
    const list = (localDb.alerts || []).filter(a => a.user_id === userId);
    list.sort((a, b) => new Date(b.sent_at) - new Date(a.sent_at) || b.id - a.id);
    return { rows: list };
  }

  if (!localDb.itineraries) localDb.itineraries = [];

  if (cleanSql.includes('select * from itineraries where user_id =')) {
    const userId = parseInt(params[0]);
    const list = localDb.itineraries.filter(i => i.user_id === userId);
    list.sort((a, b) => b.id - a.id);
    return { rows: list };
  }

  if (cleanSql.startsWith('insert into itineraries')) {
    const newItin = {
      id: localDb.itineraries.length + 1,
      user_id: parseInt(params[0]),
      title: params[1],
      start_location: params[2],
      destination: params[3],
      waypoints: params[4],
      start_date: params[5],
      end_date: params[6],
      created_at: params[7] || new Date(),
      updated_at: null
    };
    localDb.itineraries.push(newItin);
    saveLocalDb();
    return { rows: [newItin] };
  }

  if (cleanSql.startsWith('update itineraries')) {
    const title = params[0];
    const start_location = params[1];
    const destination = params[2];
    const waypoints = params[3];
    const start_date = params[4];
    const end_date = params[5];
    const updated_at = params[6];
    const id = parseInt(params[7]);

    const idx = localDb.itineraries.findIndex(i => i.id === id);
    if (idx !== -1) {
      localDb.itineraries[idx] = {
        ...localDb.itineraries[idx],
        title, start_location, destination, waypoints, start_date, end_date, updated_at
      };
      saveLocalDb();
      return { rows: [localDb.itineraries[idx]] };
    }
    return { rows: [] };
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
    let res = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
    if (res.rows.length === 0) {
      // Find first tourist
      res = await pool.query("SELECT * FROM users WHERE role = 'tourist' LIMIT 1");
    }
    if (res.rows.length > 0) {
      const user = res.rows[0];
      const targetId = user.id;
      originalUserData[targetId] = { name: user.name, id_proof_number: user.id_proof_number };
      await pool.query("UPDATE users SET name = $1, id_proof_number = $2 WHERE id = $3", [user.name + " (Tampered)", "COMPROMISED-999", targetId]);
    }
  } else {
    let user = localDb.users.find(u => u.id === userId);
    if (!user) {
      user = localDb.users.find(u => u.role === 'tourist');
    }
    if (user) {
      originalUserData[user.id] = { name: user.name, id_proof_number: user.id_proof_number };
      user.name = user.name + " (Tampered)";
      user.id_proof_number = "COMPROMISED-999";
      saveLocalDb();
    }
  }
}

async function restoreUser(userId) {
  if (usePostgres) {
    let res = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
    if (res.rows.length === 0) {
      res = await pool.query("SELECT * FROM users WHERE role = 'tourist' LIMIT 1");
    }
    if (res.rows.length > 0) {
      const user = res.rows[0];
      const targetId = user.id;
      const original = originalUserData[targetId] || { name: "Marcus Aurelius", id_proof_number: "PASSPORT-XM889" };
      await pool.query("UPDATE users SET name = $1, id_proof_number = $2 WHERE id = $3", [original.name, original.id_proof_number, targetId]);
    }
  } else {
    let user = localDb.users.find(u => u.id === userId);
    if (!user) {
      user = localDb.users.find(u => u.role === 'tourist');
    }
    if (user) {
      const original = originalUserData[user.id] || { name: "Marcus Aurelius", id_proof_number: "PASSPORT-XM889" };
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

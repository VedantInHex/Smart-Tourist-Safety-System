# Product Requirements Document (PRD)
## Smart Tourist Safety Monitoring & Incident Response System
### AI + Geo-Fencing + Blockchain Digital ID (Hackathon MVP)

---

## 1. Problem Statement

Tourists, especially in remote or high-risk areas, often lack real-time safety monitoring. Authorities have no quick way to verify tourist identity, track distress signals, or respond to incidents efficiently. There's no unified system combining **identity verification**, **location-based risk alerts**, and **AI-assisted incident detection/response**.

## 2. Goal

Build a working web app prototype (hackathon-scope, not production-grade) that demonstrates:
- Verifiable digital tourist ID (blockchain-inspired, simplified)
- Geo-fencing based risk alerts
- AI-assisted anomaly/distress detection
- Fast incident reporting & response dashboard for authorities

## 3. Target Users

| User Type | Needs |
|---|---|
| Tourist | Register, get digital ID, get safety alerts, raise SOS |
| Authority/Admin | Monitor tourists on map, view incidents, respond |

## 4. Tech Stack

- **Frontend:** React + HTML/CSS/JS
- **Backend:** Node.js + Express
- **Database:** SQL (PostgreSQL/MySQL)
- **AI:** Simple rule-based / lightweight ML model (e.g., anomaly detection on location+time patterns) — mocked/simplified for hackathon
- **Blockchain-based ID:** Simplified hash-chain simulation (SHA-256 hashed ID records) stored in SQL — **not a real blockchain network**, but demonstrates immutability concept
- **Maps/Geo-fencing:** Leaflet.js / Google Maps API + turf.js for geofence polygon checks

> **Note:** Given hackathon time constraints, "blockchain" is simulated using cryptographic hashing + tamper-evident chaining in SQL rather than deploying an actual blockchain network (e.g., Ethereum). This keeps scope realistic while demonstrating the concept.

---

## 5. Core Features (Must-Have — 4 Key Features)

### 5.1 Digital Tourist ID (Blockchain-Simulated)
- Tourist registers with name, ID proof number, phone, trip dates, emergency contact.
- System generates a unique Digital ID: a hashed record (SHA-256 of user data + timestamp + previous hash) stored in a `digital_ids` table, forming a simple hash chain to simulate tamper-evidence.
- QR code generated for the Digital ID (scannable by authorities for quick verification).
- Verification endpoint checks hash integrity against the chain.

### 5.2 Geo-Fencing & Risk Zone Alerts
- Admin defines risk zones (polygons) on a map (e.g., unsafe areas, restricted zones, high-crime zones).
- Tourist's live location (simulated via browser geolocation or manual input for demo) is checked against zones using point-in-polygon logic (turf.js).
- If tourist enters a risk zone → real-time alert shown on their app + notification pushed to admin dashboard.

### 5.3 AI-Assisted Anomaly/Distress Detection
- Basic rule-based/ML model flags anomalies:
  - No location update for X minutes in a risky area
  - Sudden stop-then-no-movement pattern
  - Deviation from planned/expected route
- Flags generate an "AI Risk Score" (Low/Medium/High) shown on the admin dashboard.
- (Hackathon simplification: use a small heuristic scoring function; can mention future scope of real ML model.)

### 5.4 SOS / Incident Reporting & Admin Response Dashboard
- Tourist app has an SOS button → creates an incident record (location, timestamp, tourist ID) instantly.
- Admin dashboard shows:
  - Live map with tourist markers (color-coded by risk score)
  - Incident list with status (Open/In Progress/Resolved)
  - Ability to assign/respond and update status

---

## 6. Small/Nice-to-Have Features (Time Permitting)

- Multi-language toggle for tourist app UI
- Trip itinerary upload (start/end location + planned route)
- Basic chat/notes on incident (admin adds response notes)
- Simple analytics widget on dashboard (total tourists, active alerts, resolved incidents)
- Dark/light theme toggle

---

## 7. User Flows

**Tourist Flow:**
Register → Get Digital ID (QR) → Enable location → Browse map/safety info → Receive geofence alert (if applicable) → Press SOS if needed → View incident status

**Admin Flow:**
Login → View live tourist map → Define/edit risk zones → Monitor AI risk scores → Receive SOS/incident alerts → Update incident status

---

## 8. Data Model (Simplified SQL Schema)

**users**
`id, name, id_proof_number, phone, email, emergency_contact, role (tourist/admin), created_at`

**digital_ids**
`id, user_id, id_hash, previous_hash, issued_at, valid_until`

**locations**
`id, user_id, latitude, longitude, timestamp`

**risk_zones**
`id, name, polygon_geojson, risk_level, created_by`

**incidents**
`id, user_id, type (sos/anomaly/geofence), latitude, longitude, status, ai_risk_score, created_at, resolved_at`

**alerts**
`id, user_id, incident_id, message, sent_at`

---

## 9. API Endpoints (Sample)

```
POST   /api/auth/register
POST   /api/auth/login
GET    /api/digital-id/:userId
POST   /api/digital-id/verify

POST   /api/location/update
GET    /api/location/live (admin)

POST   /api/geofence/create (admin)
GET    /api/geofence/check?lat=&lng=

POST   /api/incidents/sos
GET    /api/incidents (admin)
PATCH  /api/incidents/:id/status

GET    /api/ai/risk-score/:userId
```

---

## 10. Out of Scope (For Hackathon)

- Real blockchain network deployment
- Production-grade ML/AI models
- Government ID system integration
- Multi-region scalability/load testing
- Push notifications via SMS/email gateways (mock only)

---

## 11. Success Criteria (Demo Goals)

- Tourist can register and receive a Digital ID with QR
- Admin can define a geofence and see live alert trigger when tourist enters it
- SOS button creates visible incident on admin dashboard in real time
- AI risk score updates based on simple movement heuristic
- Full flow demoable end-to-end in under 5 minutes

---

## 12. Suggested Hackathon Timeline (24–36 hrs)

| Phase | Time | Tasks |
|---|---|---|
| Setup | 2 hrs | Repo, DB schema, boilerplate React + Express |
| Core Feature 1 | 4 hrs | Digital ID + hash chain + QR |
| Core Feature 2 | 5 hrs | Geo-fencing + map integration |
| Core Feature 3 | 4 hrs | AI risk scoring (heuristic) |
| Core Feature 4 | 5 hrs | SOS + admin dashboard |
| Polish | 4 hrs | Small features, UI cleanup |
| Demo Prep | 2 hrs | Seed data, script, deploy |

import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link, useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, Polygon, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import axios from 'axios';
import './App.css';

// Base API config
const API = axios.create({ baseURL: 'http://localhost:5000/api' });

API.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Custom div markers to avoid Leaflet image loading errors in Vite
const createDotMarker = (color, pulse = false) => {
  return L.divIcon({
    className: 'custom-leaflet-marker',
    html: `<div class="marker-dot ${pulse ? 'pulse' : ''}" style="background-color: ${color};"></div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
    popupAnchor: [0, -10]
  });
};

function Navigation({ user, onLogout }) {
  return (
    <nav className="navbar" id="app-nav">
      <div className="nav-brand">
        <span className="brand-icon">🛡️</span> SafeTour AI
      </div>
      <div className="nav-profile-section">
        {user ? (
          <div className="nav-user-info">
            <span className="nav-username">{user.name}</span>
            <span className={`nav-role-badge role-${user.role}`}>{user.role}</span>
            <button onClick={onLogout} className="btn-logout" id="btn-logout">Logout</button>
          </div>
        ) : (
          <div className="nav-links">
            <Link to="/login" id="nav-login" className="nav-link">Login</Link>
            <Link to="/register" id="nav-register" className="nav-link">Register</Link>
          </div>
        )}
      </div>
    </nav>
  );
}

// Map Click Listener to capture simulated user position
function MapClickListener({ onMapClick }) {
  useMapEvents({
    click(e) {
      onMapClick(e.latlng.lat, e.latlng.lng);
    }
  });
  return null;
}

// Admin Map Events to capture polygon vertices during drawing
function AdminMapEvents({ onMapClick, isDrawing }) {
  useMapEvents({
    click(e) {
      if (isDrawing) {
        onMapClick(e.latlng.lat, e.latlng.lng);
      }
    }
  });
  return null;
}

function Login({ onLoginSuccess }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');

    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    setLoading(true);
    try {
      const res = await API.post('/auth/login', { email, password });
      onLoginSuccess(res.data.user, res.data.token);
      if (res.data.user.role === 'admin') {
        navigate('/admin-dashboard');
      } else {
        navigate('/tourist-dashboard');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid credentials or connection error.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container" id="login-page">
      <div className="auth-card">
        <h2>Welcome Back</h2>
        <p className="auth-subtitle">Real-time safety routing and emergency dispatch</p>
        {error && <div className="error-alert">{error}</div>}
        <form className="auth-form" onSubmit={handleLogin}>
          <div className="form-group">
            <label htmlFor="login-email">Email Address</label>
            <input 
              type="email" 
              id="login-email" 
              placeholder="you@example.com" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required 
            />
          </div>
          <div className="form-group">
            <label htmlFor="login-password">Password</label>
            <input 
              type="password" 
              id="login-password" 
              placeholder="••••••••" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required 
            />
          </div>
          <button type="submit" id="btn-login-submit" className="btn-primary" disabled={loading}>
            {loading ? <span className="spinner-sm"></span> : 'Sign In'}
          </button>
        </form>
        <p className="auth-footer">
          Don't have an account? <Link to="/register" id="link-goto-register">Create Account</Link>
        </p>
        <div className="demo-credentials">
          <p><strong>Demo Tourist:</strong> tourist@safetour.com / tourist123</p>
          <p><strong>Demo Admin:</strong> admin@safetour.com / admin123</p>
        </div>
      </div>
    </div>
  );
}

function Register({ onLoginSuccess }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [idProof, setIdProof] = useState('');
  const [emergency, setEmergency] = useState('');
  const [role, setRole] = useState('tourist');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');

    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    setLoading(true);
    try {
      const res = await API.post('/auth/register', {
        name,
        email,
        phone,
        id_proof_number: idProof,
        emergency_contact: emergency,
        role,
        password
      });
      onLoginSuccess(res.data.user, res.data.token);
      if (res.data.user.role === 'admin') {
        navigate('/admin-dashboard');
      } else {
        navigate('/tourist-dashboard');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container" id="register-page">
      <div className="auth-card">
        <h2>Join SafeTour</h2>
        <p className="auth-subtitle">Instant geofencing alerts and emergency help</p>
        {error && <div className="error-alert">{error}</div>}
        <form className="auth-form" onSubmit={handleRegister}>
          <div className="form-group-row">
            <div className="form-group">
              <label htmlFor="reg-name">Full Name</label>
              <input type="text" id="reg-name" placeholder="John Doe" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="form-group">
              <label htmlFor="reg-email">Email Address</label>
              <input type="email" id="reg-email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
          </div>
          
          <div className="form-group-row">
            <div className="form-group">
              <label htmlFor="reg-phone">Phone Number</label>
              <input type="text" id="reg-phone" placeholder="+1 234 567 89" value={phone} onChange={(e) => setPhone(e.target.value)} required />
            </div>
            <div className="form-group">
              <label htmlFor="reg-idproof">ID Proof Number</label>
              <input type="text" id="reg-idproof" placeholder="Passport/NID" value={idProof} onChange={(e) => setIdProof(e.target.value)} required />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="reg-emergency">Emergency Contact Details</label>
            <input type="text" id="reg-emergency" placeholder="Name, Relation, Phone" value={emergency} onChange={(e) => setEmergency(e.target.value)} required />
          </div>

          <div className="form-group-row">
            <div className="form-group">
              <label htmlFor="reg-role">Register As</label>
              <select id="reg-role" value={role} onChange={(e) => setRole(e.target.value)}>
                <option value="tourist">Tourist</option>
                <option value="admin">Search & Rescue Admin</option>
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="reg-password">Password</label>
              <input type="password" id="reg-password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
          </div>

          <button type="submit" id="btn-register-submit" className="btn-primary">Sign Up</button>
        </form>
        <p className="auth-footer">
          Already registered? <Link to="/login" id="link-goto-login">Sign In</Link>
        </p>
      </div>
    </div>
  );
}

function TouristDashboard({ user }) {
  const [lat, setLat] = useState(46.2023);
  const [lng, setLng] = useState(6.1432);
  const [digitalId, setDigitalId] = useState(null);
  const [qrCode, setQrCode] = useState('');
  const [geofences, setGeofences] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [aiRisk, setAiRisk] = useState({ riskScore: 'Low', explanation: 'Gathering active GPS updates...' });
  const [sosStatus, setSosStatus] = useState(null); // 'sending' | 'active'
  const [geofenceViolation, setGeofenceViolation] = useState(null);
  const [myIncidents, setMyIncidents] = useState([]);

  // Fetch Digital ID
  useEffect(() => {
    const fetchId = async () => {
      try {
        const res = await API.get(`/digital-id/${user.id}`);
        setDigitalId(res.data.digitalId);
        setQrCode(res.data.qrCode);
      } catch (e) {
        console.error("Failed to load digital ID details", e);
      }
    };
    fetchId();
  }, [user.id]);

  // Fetch Geofences
  useEffect(() => {
    const fetchFences = async () => {
      try {
        const res = await API.get('/geofence/list');
        setGeofences(res.data);
      } catch (e) {
        console.error("Failed to load geofences list", e);
      }
    };
    fetchFences();
  }, []);

  // Poll alerts and AI Risk assessment
  useEffect(() => {
    const pollUpdates = async () => {
      try {
        const resAlerts = await API.get(`/incidents/alerts/${user.id}`);
        setAlerts(resAlerts.data);

        const resAi = await API.get(`/ai/risk-score/${user.id}`);
        setAiRisk(resAi.data);

        const resInc = await API.get('/incidents/my');
        setMyIncidents(resInc.data);
      } catch (e) {
        console.error("Polling failure:", e);
      }
    };

    pollUpdates();
    const interval = setInterval(pollUpdates, 4000);
    return () => clearInterval(interval);
  }, [user.id]);

  // Location update trigger
  const updateLocation = async (newLat, newLng) => {
    setLat(newLat);
    setLng(newLng);
    setGeofenceViolation(null);

    try {
      const res = await API.post('/location/update', {
        user_id: user.id,
        latitude: newLat,
        longitude: newLng
      });

      if (res.data.triggeredGeofences && res.data.triggeredGeofences.length > 0) {
        setGeofenceViolation(res.data.triggeredGeofences[0]);
      }
    } catch (err) {
      console.error("Error sending coordinates:", err);
    }
  };

  const handleSos = async () => {
    setSosStatus('sending');
    try {
      await API.post('/incidents/sos', {
        user_id: user.id,
        latitude: lat,
        longitude: lng
      });
      setSosStatus('active');
      setTimeout(() => setSosStatus(null), 8000);
    } catch (err) {
      console.error("SOS Trigger Error", err);
      setSosStatus(null);
    }
  };

  const handleSimulateImmobility = async () => {
    try {
      for (let i = 0; i < 3; i++) {
        await API.post('/location/update', {
          user_id: user.id,
          latitude: lat,
          longitude: lng
        });
      }
      const resAi = await API.get(`/ai/risk-score/${user.id}`);
      setAiRisk(resAi.data);
    } catch (err) {
      console.error("Immobility simulation error", err);
    }
  };

  const handleSimulateSignalLoss = async () => {
    const hazardLat = 46.208;
    const hazardLng = 6.153;
    const pastTime = new Date(Date.now() - 6 * 60 * 1000).toISOString();
    
    setLat(hazardLat);
    setLng(hazardLng);

    try {
      const res = await API.post('/location/update', {
        user_id: user.id,
        latitude: hazardLat,
        longitude: hazardLng,
        timestamp: pastTime
      });
      
      if (res.data.triggeredGeofences && res.data.triggeredGeofences.length > 0) {
        setGeofenceViolation(res.data.triggeredGeofences[0]);
      }
      
      const resAi = await API.get(`/ai/risk-score/${user.id}`);
      setAiRisk(resAi.data);
    } catch (err) {
      console.error("Signal loss simulation error", err);
    }
  };

  const handleResetSimulation = async () => {
    const normalLat = 46.2023;
    const normalLng = 6.1432;
    setLat(normalLat);
    setLng(normalLng);
    setGeofenceViolation(null);

    try {
      await API.post('/location/update', {
        user_id: user.id,
        latitude: normalLat,
        longitude: normalLng
      });
      
      const resAi = await API.get(`/ai/risk-score/${user.id}`);
      setAiRisk(resAi.data);
    } catch (err) {
      console.error("Reset simulation error", err);
    }
  };

  return (
    <div className="dashboard-container" id="tourist-dashboard-page">
      {geofenceViolation && (
        <div className="neon-modal-overlay">
          <div className="neon-modal card-warning-border animate-pop">
            <span className="modal-icon">⚠️</span>
            <h2>GEOFENCE INTRUSION ALERT</h2>
            <p>You have entered a restricted or hazardous area: <strong>{geofenceViolation.name}</strong></p>
            <p className="risk-level-alert">Danger Risk Index: <span className="risk-badge-red">{geofenceViolation.risk_level}</span></p>
            <button className="btn-modal-dismiss" onClick={() => setGeofenceViolation(null)}>Acknowledge Threat</button>
          </div>
        </div>
      )}

      <header className="dash-header">
        <div>
          <h1>Tourist Safety Hub</h1>
          <p className="dash-subtitle">SafeTour AI Active Incident Response Safeguards</p>
        </div>
        <div className="safety-actions">
          <button 
            onClick={handleSos} 
            className={`btn-sos ${sosStatus === 'active' ? 'sos-alarm' : ''}`}
            disabled={sosStatus === 'sending'}
            id="btn-sos-trigger"
          >
            {sosStatus === 'sending' ? 'Sending SOS...' : sosStatus === 'active' ? 'SOS BROADCASTING' : '🚨 EMERGENCY SOS'}
          </button>
        </div>
      </header>

      <div className="dashboard-grid">
        {/* Left Side: Map & Geolocation Simulation */}
        <div className="dash-card main-map-container">
          <div className="card-header">
            <h3>Active Safety Map</h3>
            <span className="card-tag">Interact to Simulate Geolocation</span>
          </div>

          <div className="map-wrapper-box">
            <MapContainer center={[lat, lng]} zoom={14} className="leaflet-map-element">
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              />
              <MapClickListener onMapClick={updateLocation} />
              
              {/* Current Position Marker */}
              <Marker position={[lat, lng]} icon={createDotMarker(sosStatus === 'active' ? '#ef4444' : '#3b82f6', true)}>
                <Popup>
                  <div>
                    <strong>Your Simulated Position</strong><br/>
                    Coordinates: {lat.toFixed(5)}, {lng.toFixed(5)}
                  </div>
                </Popup>
              </Marker>

              {/* Geofences Polygons */}
              {geofences.map(gf => {
                const colors = { High: '#ef4444', Medium: '#f59e0b', Low: '#10b981' };
                return (
                  <Polygon 
                    key={gf.id} 
                    positions={gf.polygon_geojson.coordinates[0].map(c => [c[1], c[0]])} 
                    pathOptions={{ color: colors[gf.risk_level] || '#aa3bff', fillColor: colors[gf.risk_level], fillOpacity: 0.15 }}
                  >
                    <Popup>
                      <strong>{gf.name}</strong><br/>
                      Danger Risk: {gf.risk_level}
                    </Popup>
                  </Polygon>
                );
              })}
            </MapContainer>
          </div>

          {/* Location Simulator Sliders */}
          <div className="simulation-sliders">
            <h4>Manual Coordinates Tuning (Geneva Scenic Area)</h4>
            <p className="sim-helper">Adjust sliders or click on the map to trigger geofence entries.</p>
            <div className="slider-group">
              <label>Latitude: {lat.toFixed(5)}</label>
              <input 
                type="range" 
                min="46.1950" 
                max="46.2200" 
                step="0.0001" 
                value={lat} 
                onChange={(e) => updateLocation(parseFloat(e.target.value), lng)}
              />
            </div>
            <div className="slider-group">
              <label>Longitude: {lng.toFixed(5)}</label>
              <input 
                type="range" 
                min="6.1300" 
                max="6.1700" 
                step="0.0001" 
                value={lng} 
                onChange={(e) => updateLocation(lat, parseFloat(e.target.value))}
              />
            </div>
          </div>
        </div>

        {/* Right Side: Digital ID, AI Risk, Alerts Feed */}
        <div className="dash-sidebar">
          {/* Digital ID Panel */}
          {digitalId && (
            <div className="dash-card digital-id-card">
              <div className="card-header">
                <h3>Digital Tourist ID</h3>
                <span className="card-tag secure-tag">🔒 Blockchain Hashed</span>
              </div>
              <div className="id-card-content">
                <div className="qr-box">
                  {qrCode && <img src={qrCode} alt="Digital ID QR Code" className="qr-img" />}
                </div>
                <div className="id-details">
                  <p><strong>Name:</strong> {user.name}</p>
                  <p><strong>ID Proof:</strong> {user.id_proof_number}</p>
                  <p><strong>Trips Validity:</strong> 1 Year</p>
                  <div className="blockchain-ledger-box">
                    <span className="hash-label">Cryptographic Hash Link:</span>
                    <code className="hash-code">{digitalId.id_hash.substring(0, 16)}...</code>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* AI Risk Score Panel */}
          <div className="dash-card ai-risk-card">
            <h3>AI Safety Guard</h3>
            <div className="ai-risk-status">
              <div className={`ai-score-display score-${aiRisk.riskScore.toLowerCase()}`}>
                <span className="score-val">{aiRisk.riskScore} Risk</span>
              </div>
              <div className="ai-explanation">
                <h4>Heuristic Assessment:</h4>
                <p>{aiRisk.explanation}</p>
              </div>
            </div>
          </div>

          {/* AI Safety Simulator Panel */}
          <div className="dash-card simulation-panel-card">
            <h3>AI Safety Simulator</h3>
            <p className="sim-helper">Instantly trigger location anomalies for the demo.</p>
            <div className="sim-actions-list">
              <button onClick={handleSimulateImmobility} className="btn-sim-action action-immobility">
                🚶‍♂️ Simulate Immobility
              </button>
              <button onClick={handleSimulateSignalLoss} className="btn-sim-action action-signalloss">
                📡 Simulate Signal Loss
              </button>
              <button onClick={handleResetSimulation} className="btn-sim-action action-reset">
                🔄 Reset Simulation
              </button>
            </div>
          </div>

          {/* My Incidents Tracker Panel */}
          <div className="dash-card my-incidents-card">
            <h3>My Incident Tracker</h3>
            <div className="incidents-scroll-box">
              {myIncidents.length === 0 ? (
                <p className="no-alerts">No incidents reported yet.</p>
              ) : (
                myIncidents.map(inc => (
                  <div key={inc.id} className={`incident-item border-${(inc.ai_risk_score || 'low').toLowerCase()} ${inc.status === 'Resolved' ? 'resolved-dim' : ''}`}>
                    <div className="incident-header">
                      <span className={`risk-badge-${(inc.ai_risk_score || 'low').toLowerCase()}`}>{inc.ai_risk_score}</span>
                      <span className="incident-type">{inc.type.toUpperCase()}</span>
                      <span className="incident-time">{new Date(inc.created_at).toLocaleTimeString()}</span>
                    </div>
                    <div className="incident-body">
                      <p><strong>Coordinates:</strong> {inc.latitude.toFixed(5)}, {inc.longitude.toFixed(5)}</p>
                      <p><strong>Status:</strong> <span className={`status-label status-${inc.status.toLowerCase().replace(' ', '-')}`}>{inc.status}</span></p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Alerts Feed Panel */}
          <div className="dash-card alerts-feed-card">
            <h3>Incident Logs & Broadcasts</h3>
            <div className="alerts-scroll-box">
              {alerts.length === 0 ? (
                <p className="no-alerts">No safety broadcasts received.</p>
              ) : (
                alerts.map(a => (
                  <div key={a.id} className="alerts-feed-item">
                    <span className="feed-dot"></span>
                    <div className="feed-body">
                      <p>{a.message}</p>
                      <small>{new Date(a.sent_at).toLocaleTimeString()}</small>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function AdminDashboard({ user }) {
  const [tourists, setTourists] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [geofences, setGeofences] = useState([]);
  
  // Geofence Creation State
  const [isDrawing, setIsDrawing] = useState(false);
  const [draftPoints, setDraftPoints] = useState([]);
  const [newFenceName, setNewFenceName] = useState('');
  const [newFenceRisk, setNewFenceRisk] = useState('High');

  // Ledger Verification State
  const [verificationLog, setVerificationLog] = useState(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isTampering, setIsTampering] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  // Authority Verification State
  const [qrPayloadInput, setQrPayloadInput] = useState('');
  const [qrVerificationResult, setQrVerificationResult] = useState(null);

  const fetchTourists = async () => {
    try {
      const res = await API.get('/location/live');
      setTourists(res.data);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchIncidents = async () => {
    try {
      const res = await API.get('/incidents');
      setIncidents(res.data);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchFences = async () => {
    try {
      const res = await API.get('/geofence/list');
      setGeofences(res.data);
    } catch (e) {
      console.error(e);
    }
  };

  // Poll data
  useEffect(() => {
    fetchTourists();
    fetchIncidents();
    fetchFences();

    const interval = setInterval(() => {
      fetchTourists();
      fetchIncidents();
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const handleUpdateStatus = async (id, newStatus) => {
    try {
      await API.patch(`/incidents/${id}/status`, { status: newStatus });
      fetchIncidents();
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteGeofence = async (id) => {
    if (window.confirm("Are you sure you want to delete this geofence boundary?")) {
      try {
        await API.delete(`/geofence/${id}`);
        fetchFences();
      } catch (err) {
        console.error("Failed to delete geofence", err);
      }
    }
  };

  const verifyLedger = async () => {
    setIsVerifying(true);
    setVerificationLog(null);
    try {
      const res = await API.get('/digital-id/chain/verify');
      setVerificationLog(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setIsVerifying(false);
    }
  };

  const handleVerifyQrCode = async () => {
    setQrVerificationResult(null);
    try {
      const parsed = JSON.parse(qrPayloadInput);
      const res = await API.post('/digital-id/verify', parsed);
      setQrVerificationResult(res.data);
    } catch {
      setQrVerificationResult({
        verified: false,
        error: "Invalid QR code payload format. Must be a valid JSON object."
      });
    }
  };

  const handleTamperDatabase = async () => {
    setIsTampering(true);
    try {
      await API.post('/auth/test/tamper', { userId: 2 });
      alert("Database tampered! Tourist Marcus Aurelius's record has been altered in the database. Perform Audit to see validation error.");
      setVerificationLog(null);
    } catch (err) {
      console.error(err);
    } finally {
      setIsTampering(false);
    }
  };

  const handleRestoreDatabase = async () => {
    setIsRestoring(true);
    try {
      await API.post('/auth/test/restore', { userId: 2 });
      alert("Database restored to authentic state. Perform Audit to verify ledger integrity.");
      setVerificationLog(null);
    } catch (err) {
      console.error(err);
    } finally {
      setIsRestoring(false);
    }
  };

  // Handle vertex addition inside Geofence Creator
  const addDraftPoint = (lat, lng) => {
    setDraftPoints([...draftPoints, [lng, lat]]);
  };

  const handleSaveGeofence = async () => {
    if (!newFenceName || draftPoints.length < 3) {
      alert("Please name the fence and draw at least 3 points on the map.");
      return;
    }

    // Add first point at the end to close the loop for GeoJSON compliance
    const closedPoints = [...draftPoints, draftPoints[0]];

    const geojson = {
      type: "Polygon",
      coordinates: [closedPoints]
    };

    try {
      await API.post('/geofence/create', {
        name: newFenceName,
        polygon_geojson: geojson,
        risk_level: newFenceRisk,
        created_by: user.id
      });
      
      setNewFenceName('');
      setDraftPoints([]);
      setIsDrawing(false);
      fetchFences();
    } catch (err) {
      console.error("Geofence Save Error:", err);
      alert("Error saving geofence.");
    }
  };

  return (
    <div className="dashboard-container" id="admin-dashboard-page">
      <header className="dash-header">
        <div>
          <h1>Search & Rescue Control Room</h1>
          <p className="dash-subtitle">Incident Response Command Centre & Geofence Dispatch</p>
        </div>
        <div className="admin-status">
          🟢 Local Network Operational
        </div>
      </header>

      {/* Stats row */}
      <div className="dashboard-grid admin-stats">
        <div className="dash-card stat-card">
          <h4>Monitored Tourists</h4>
          <p className="stat-val">{tourists.length}</p>
          <span className="stat-change text-green">Live GPS updates active</span>
        </div>
        <div className="dash-card stat-card">
          <h4>Active Geofences</h4>
          <p className="stat-val">{geofences.length}</p>
          <span className="stat-change text-orange">Polygon risk boundaries</span>
        </div>
        <div className="dash-card stat-card">
          <h4>Pending SOS Alarms</h4>
          <p className="stat-val text-orange">
            {incidents.filter(i => i.status !== 'Resolved' && i.type === 'sos').length}
          </p>
          <span className="stat-change text-red">Awaiting dispatch teams</span>
        </div>
      </div>

      <div className="dashboard-grid">
        {/* Left Side: Admin Map and drawing board */}
        <div className="dash-card main-map-container">
          <div className="card-header">
            <h3>Central Emergency Mapping</h3>
            {isDrawing ? (
              <span className="draw-instructions animate-pulse">Click points on map to sketch polygon. {draftPoints.length} vertices added.</span>
            ) : (
              <button className="btn-sm btn-draw-trigger" onClick={() => setIsDrawing(true)}>✏️ Dispatch Geofence</button>
            )}
          </div>

          <div className="map-wrapper-box">
            <MapContainer center={[46.2044, 6.1432]} zoom={13} className="leaflet-map-element">
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              />
              <AdminMapEvents onMapClick={addDraftPoint} isDrawing={isDrawing} />

              {/* Render tourists */}
              {tourists.map(tourist => {
                // Find user's pending incidents to see if SOS is active
                const hasSos = incidents.some(i => i.user_id === tourist.user_id && i.type === 'sos' && i.status !== 'Resolved');
                return (
                  <Marker 
                    key={tourist.id} 
                    position={[tourist.latitude, tourist.longitude]}
                    icon={createDotMarker(hasSos ? '#ef4444' : '#10b981', hasSos)}
                  >
                    <Popup>
                      <div>
                        <strong>{tourist.name}</strong><br/>
                        Phone: {tourist.phone}<br/>
                        Last Updated: {new Date(tourist.timestamp).toLocaleTimeString()}<br/>
                        {hasSos && <span className="sos-map-badge">🚨 EMERGENCY SOS</span>}
                      </div>
                    </Popup>
                  </Marker>
                );
              })}

              {/* Render active geofences */}
              {geofences.map(gf => {
                const colors = { High: '#ef4444', Medium: '#f59e0b', Low: '#10b981' };
                return (
                  <Polygon 
                    key={gf.id} 
                    positions={gf.polygon_geojson.coordinates[0].map(c => [c[1], c[0]])} 
                    pathOptions={{ color: colors[gf.risk_level], fillColor: colors[gf.risk_level], fillOpacity: 0.15 }}
                  >
                    <Popup>
                      <strong>{gf.name}</strong><br/>
                      Danger level: {gf.risk_level}
                    </Popup>
                  </Polygon>
                );
              })}

              {/* Render current polygon sketch draft */}
              {draftPoints.length > 0 && (
                <Polygon 
                  positions={draftPoints.map(p => [p[1], p[0]])}
                  pathOptions={{ color: '#8b5cf6', dashArray: '5, 5' }}
                />
              )}
            </MapContainer>
          </div>

          {/* Draw Geofence Panel */}
          {isDrawing && (
            <div className="drawing-panel animate-slide">
              <h4>Geofence Polygon Coordinates Creator</h4>
              <div className="form-group-row">
                <input 
                  type="text" 
                  placeholder="Zone Name (e.g. Danger Shoreline)" 
                  value={newFenceName}
                  onChange={(e) => setNewFenceName(e.target.value)}
                  className="input-draw-name"
                />
                <select value={newFenceRisk} onChange={(e) => setNewFenceRisk(e.target.value)}>
                  <option value="High">High Risk (Red)</option>
                  <option value="Medium">Medium Risk (Orange)</option>
                  <option value="Low">Low Risk (Green)</option>
                </select>
              </div>
              <div className="draw-actions">
                <button className="btn-primary" onClick={handleSaveGeofence}>Save Geofence</button>
                <button className="btn-sm" onClick={() => { setDraftPoints([]); setIsDrawing(false); }}>Cancel</button>
              </div>
            </div>
          )}
        </div>

        {/* Right Side: Incident Logs & Blockchain Ledger verification */}
        <div className="dash-sidebar">
          {/* Active Incidents Command */}
          <div className="dash-card admin-incidents-card">
            <h3>Active Incident Dispatch</h3>
            <div className="incidents-scroll-box">
              {incidents.length === 0 ? (
                <p className="no-alerts">No alerts or distress signals reported.</p>
              ) : (
                incidents.map(inc => (
                  <div key={inc.id} className={`incident-item border-${inc.ai_risk_score.toLowerCase()} ${inc.status === 'Resolved' ? 'resolved-dim' : ''}`}>
                    <div className="incident-header">
                      <span className={`risk-badge-${inc.ai_risk_score.toLowerCase()}`}>{inc.ai_risk_score}</span>
                      <span className="incident-type">{inc.type.toUpperCase()}</span>
                      <span className="incident-time">{new Date(inc.created_at).toLocaleTimeString()}</span>
                    </div>
                    <div className="incident-body">
                      <p><strong>User:</strong> {inc.user_name} ({inc.user_phone})</p>
                      <p><strong>Coordinates:</strong> {inc.latitude.toFixed(5)}, {inc.longitude.toFixed(5)}</p>
                      <p><strong>Status:</strong> <span className={`status-label status-${inc.status.toLowerCase()}`}>{inc.status}</span></p>
                    </div>
                    {inc.status !== 'Resolved' && (
                      <div className="incident-actions">
                        {inc.status === 'Open' && (
                          <button className="btn-sm btn-dispatch" onClick={() => handleUpdateStatus(inc.id, 'In Progress')}>Dispatch Response</button>
                        )}
                        <button className="btn-sm btn-resolve" onClick={() => handleUpdateStatus(inc.id, 'Resolved')}>Mark Resolved</button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Blockchain integrity checking */}
          {/* Authority Verification Terminal */}
          <div className="dash-card qr-verification-card">
            <h3>Authority Verification Terminal</h3>
            <p className="sim-helper">Paste QR payload to verify identity signature.</p>
            <div className="verification-form">
              <textarea 
                rows="2" 
                placeholder='Paste QR Code JSON payload here...' 
                value={qrPayloadInput} 
                onChange={(e) => setQrPayloadInput(e.target.value)}
                className="qr-textarea"
              />
              <button onClick={handleVerifyQrCode} className="btn-primary btn-verify-qr">
                Verify QR Signature
              </button>
            </div>
            {qrVerificationResult && (
              <div className="verification-result animate-pop">
                {qrVerificationResult.verified ? (
                  <div className="result-alert result-success">
                    <span className="badge-icon">✅</span>
                    <div>
                      <h4>AUTHENTIC DIGITAL ID</h4>
                      <p><strong>Name:</strong> {qrVerificationResult.user.name}</p>
                      <p><strong>Passport/NID:</strong> {qrVerificationResult.user.id_proof_number}</p>
                      <p><strong>Status:</strong> Valid until {new Date(qrVerificationResult.valid_until).toLocaleDateString()}</p>
                      <code className="signature-code">Sig status: SECURE</code>
                    </div>
                  </div>
                ) : (
                  <div className="result-alert result-danger">
                    <span className="badge-icon">❌</span>
                    <div>
                      <h4>VERIFICATION FAILED</h4>
                      <p className="error-text">{qrVerificationResult.error}</p>
                      <code className="signature-code">Sig status: COMPROMISED</code>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Ledger Cryptographic Audit */}
          <div className="dash-card blockchain-card">
            <div className="card-header">
              <h3>Ledger Cryptographic Audit</h3>
              <button 
                className="btn-sm btn-audit" 
                onClick={verifyLedger}
                disabled={isVerifying}
              >
                {isVerifying ? 'Auditing...' : '🔍 Audit Ledger'}
              </button>
            </div>
            
            {verificationLog ? (
              <div className="audit-results-box animate-pop">
                {verificationLog.verified ? (
                  <div className="audit-alert audit-success">
                    <span className="audit-badge-icon">✅</span>
                    <div>
                      <h4>BLOCKCHAIN LEDGER SECURE</h4>
                      <p>Chain verification checks succeeded! Chain length: {verificationLog.chainLength} blocks. Digital ID records match SHA-256 links.</p>
                    </div>
                  </div>
                ) : (
                  <div className="audit-alert audit-failure">
                    <span className="audit-badge-icon">❌</span>
                    <div>
                      <h4>TAMPERING DETECTED!</h4>
                      <p>Security compromise detected at Block ID: {verificationLog.blockId}. Recalculation mismatch!</p>
                      <p className="audit-err-desc">{verificationLog.error}</p>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="no-alerts">Verify simulated cryptographic identity chains stored in SQL database.</p>
            )}

            <div className="tamper-simulation-controls">
              <span className="control-label">Demo Attack Simulator:</span>
              <div className="control-buttons">
                <button 
                  onClick={handleTamperDatabase} 
                  className="btn-sm btn-tamper-db" 
                  disabled={isTampering}
                >
                  {isTampering ? 'Altering...' : '💥 Tamper DB'}
                </button>
                <button 
                  onClick={handleRestoreDatabase} 
                  className="btn-sm btn-repair-db" 
                  disabled={isRestoring}
                >
                  {isRestoring ? 'Restoring...' : '🔧 Repair DB'}
                </button>
              </div>
            </div>
          </div>

          {/* Geofence Boundary Registry */}
          <div className="dash-card geofence-registry-card">
            <h3>Geofence Boundary Registry</h3>
            <div className="registry-list-box">
              {geofences.length === 0 ? (
                <p className="no-alerts">No geofences defined.</p>
              ) : (
                <table className="geofence-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Risk</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {geofences.map(gf => (
                      <tr key={gf.id}>
                        <td><strong>{gf.name}</strong></td>
                        <td><span className={`risk-badge-${gf.risk_level.toLowerCase()}`}>{gf.risk_level}</span></td>
                        <td>
                          <button onClick={() => handleDeleteGeofence(gf.id)} className="btn-sm btn-delete-gf">Delete</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="auth-container">
          <div className="auth-card" style={{ textAlign: 'center' }}>
            <h2 style={{ color: 'var(--accent-red)' }}>⚠️ System Error</h2>
            <p className="auth-subtitle">Something went wrong while rendering this page.</p>
            <button 
              className="btn-primary" 
              onClick={() => { this.setState({ hasError: false }); window.location.href = '/'; }}
              style={{ marginTop: '1rem' }}
            >
              Return to Home
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function App() {
  const [user, setUser] = useState(null);

  // Auto login from localstorage if token exists
  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
  }, []);

  const handleLoginSuccess = (userData, token) => {
    localStorage.setItem('user', JSON.stringify(userData));
    localStorage.setItem('token', token);
    setUser(userData);
  };

  const handleLogout = () => {
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    setUser(null);
  };

  return (
    <Router>
      <div className="app-wrapper">
        <Navigation user={user} onLogout={handleLogout} />
        <main className="app-content">
          <ErrorBoundary>
            <Routes>
              <Route 
                path="/login" 
                element={user ? <Navigate to={user.role === 'admin' ? '/admin-dashboard' : '/tourist-dashboard'} replace /> : <Login onLoginSuccess={handleLoginSuccess} />} 
              />
              <Route 
                path="/register" 
                element={user ? <Navigate to={user.role === 'admin' ? '/admin-dashboard' : '/tourist-dashboard'} replace /> : <Register onLoginSuccess={handleLoginSuccess} />} 
              />
              <Route 
                path="/tourist-dashboard" 
                element={user && user.role === 'tourist' ? <TouristDashboard user={user} /> : <Navigate to="/login" replace />} 
              />
              <Route 
                path="/admin-dashboard" 
                element={user && user.role === 'admin' ? <AdminDashboard user={user} /> : <Navigate to="/login" replace />} 
              />
              <Route 
                path="/" 
                element={<Navigate to="/login" replace />} 
              />
            </Routes>
          </ErrorBoundary>
        </main>
      </div>
    </Router>
  );
}

export default App;

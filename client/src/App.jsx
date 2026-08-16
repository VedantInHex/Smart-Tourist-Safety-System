import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link, useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, Polygon, Polyline, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import axios from 'axios';
import { translations } from './translations';
import './App.css';

// Base API config
const API = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api'
});

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
    iconSize: [22, 22],
    iconAnchor: [11, 11],
    popupAnchor: [0, -12]
  });
};

// Helper component to smoothly re-center Leaflet Map when coordinates change
function ChangeMapView({ center, zoom }) {
  const map = useMap();
  useEffect(() => {
    if (center && center[0] !== undefined && center[1] !== undefined && !isNaN(center[0]) && !isNaN(center[1])) {
      map.flyTo(center, zoom || map.getZoom(), { duration: 1.2 });
    }
  }, [center, zoom, map]);
  return null;
}

// Leaflet calculates its canvas size at mount time.  Recalculate it when a
// responsive dashboard card changes size so tiles and click targets stay aligned.
function KeepMapSized() {
  const map = useMap();

  useEffect(() => {
    const invalidate = () => map.invalidateSize({ pan: false });
    const container = map.getContainer();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(invalidate);
    observer?.observe(container);
    window.addEventListener('resize', invalidate);
    const frame = requestAnimationFrame(invalidate);

    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener('resize', invalidate);
    };
  }, [map]);

  return null;
}

function getPolygonPositions(polygonGeojson) {
  try {
    const geo = typeof polygonGeojson === 'string' ? JSON.parse(polygonGeojson) : polygonGeojson;
    const geometry = geo?.type === 'Feature' ? geo.geometry : geo;
    const ring = geometry?.type === 'Polygon' ? geometry.coordinates?.[0] : null;

    if (!Array.isArray(ring)) return [];
    return ring
      .filter(([longitude, latitude]) => Number.isFinite(Number(latitude)) && Number.isFinite(Number(longitude)))
      .map(([longitude, latitude]) => [Number(latitude), Number(longitude)]);
  } catch {
    return [];
  }
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

// Location presets for rapid testing
const LOCATION_PRESETS = [
  { id: 'delhi', name: '🇮🇳 New Delhi (Connaught Place)', lat: 28.6280, lng: 77.2180, zoom: 14 },
  { id: 'goa', name: '🇮🇳 Goa Beach (Baga / Calangute)', lat: 15.5520, lng: 73.7530, zoom: 14 },
  { id: 'manali', name: '🇮🇳 Manali / Himalayas (Rohtang)', lat: 32.3700, lng: 77.2450, zoom: 13 },
  { id: 'mumbai', name: '🇮🇳 Mumbai (Marine Drive)', lat: 18.9430, lng: 72.8230, zoom: 14 },
  { id: 'geneva', name: '🇨🇭 Geneva (Lakeside)', lat: 46.2044, lng: 6.1432, zoom: 14 }
];

function Navigation({ user, onLogout, theme, onToggleTheme, lang, onChangeLang }) {
  const t = (key) => translations[lang]?.[key] || translations.en[key] || key;

  return (
    <nav className="navbar" id="app-nav">
      <div className="nav-brand">
        <span className="brand-icon">🛡️</span> {t('brand')}
      </div>
      <div className="nav-profile-section">
        <select 
          value={lang} 
          onChange={(e) => onChangeLang(e.target.value)}
          className="lang-select" 
          id="select-language"
          aria-label="Language Selector"
        >
          <option value="en">🇺🇸 EN (English)</option>
          <option value="hi">🇮🇳 HI (हिंदी)</option>
          <option value="fr">🇫🇷 FR (Français)</option>
          <option value="es">🇪🇸 ES (Español)</option>
        </select>
        <button onClick={onToggleTheme} className="btn-sm btn-theme-toggle" title="Toggle Light/Dark Theme">
          {theme === 'dark' ? `☀️ ${t('lightTheme')}` : `🌙 ${t('darkTheme')}`}
        </button>
        {user ? (
          <div className="nav-user-info">
            <span className="nav-username">{user.name}</span>
            <span className={`nav-role-badge role-${user.role}`}>{user.role}</span>
            <button onClick={onLogout} className="btn-logout" id="btn-logout">{t('logout')}</button>
          </div>
        ) : (
          <div className="nav-links">
            <Link to="/login" id="nav-login" className="nav-link">{t('login')}</Link>
            <Link to="/register" id="nav-register" className="nav-link">{t('register')}</Link>
          </div>
        )}
      </div>
    </nav>
  );
}

function Login({ onLoginSuccess, lang }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const t = (key) => translations[lang]?.[key] || translations.en[key] || key;

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
        <h2>{t('welcomeBack')}</h2>
        <p className="auth-subtitle">{t('signInSubtitle')}</p>
        {error && <div className="error-alert">{error}</div>}
        <form className="auth-form" onSubmit={handleLogin}>
          <div className="form-group">
            <label htmlFor="login-email">{t('emailLabel')}</label>
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
            <label htmlFor="login-password">{t('passwordLabel')}</label>
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
            {loading ? <span className="spinner-sm"></span> : t('signInBtn')}
          </button>
        </form>
        <p className="auth-footer">
          {t('noAccount')} <Link to="/register" id="link-goto-register">{t('createAccount')}</Link>
        </p>
        <div className="demo-credentials">
          <p><strong>Demo Tourist:</strong> tourist@safetour.com / tourist123</p>
          <p><strong>Demo Admin:</strong> admin@safetour.com / admin123</p>
        </div>
      </div>
    </div>
  );
}

function Register({ onLoginSuccess, lang }) {
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
  const t = (key) => translations[lang]?.[key] || translations.en[key] || key;

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
        <h2>{t('joinTitle')}</h2>
        <p className="auth-subtitle">{t('joinSubtitle')}</p>
        {error && <div className="error-alert">{error}</div>}
        <form className="auth-form" onSubmit={handleRegister}>
          <div className="form-group-row">
            <div className="form-group">
              <label htmlFor="reg-name">{t('fullName')}</label>
              <input type="text" id="reg-name" placeholder="John Doe" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="form-group">
              <label htmlFor="reg-email">{t('emailLabel')}</label>
              <input type="email" id="reg-email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
          </div>
          
          <div className="form-group-row">
            <div className="form-group">
              <label htmlFor="reg-phone">{t('phoneNumber')}</label>
              <input type="text" id="reg-phone" placeholder="+91 98765 43210" value={phone} onChange={(e) => setPhone(e.target.value)} required />
            </div>
            <div className="form-group">
              <label htmlFor="reg-idproof">{t('idProof')}</label>
              <input type="text" id="reg-idproof" placeholder="Aadhaar / Passport / ID" value={idProof} onChange={(e) => setIdProof(e.target.value)} required />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="reg-emergency">{t('emergencyContact')}</label>
            <input type="text" id="reg-emergency" placeholder="Name, Relation, Phone Number" value={emergency} onChange={(e) => setEmergency(e.target.value)} required />
          </div>

          <div className="form-group-row">
            <div className="form-group">
              <label htmlFor="reg-role">{t('registerAs')}</label>
              <select id="reg-role" value={role} onChange={(e) => setRole(e.target.value)}>
                <option value="tourist">{t('touristRole')}</option>
                <option value="admin">{t('adminRole')}</option>
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="reg-password">{t('passwordLabel')}</label>
              <input type="password" id="reg-password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
          </div>

          <button type="submit" id="btn-register-submit" className="btn-primary">{t('createAccount')}</button>
        </form>
        <p className="auth-footer">
          {t('haveAccount')} <Link to="/login" id="link-goto-login">{t('signInBtn')}</Link>
        </p>
      </div>
    </div>
  );
}

function TouristDashboard({ user, lang }) {
  // Coordinates State (defaulting to India - New Delhi, updated immediately via GPS)
  const [lat, setLat] = useState(28.6280);
  const [lng, setLng] = useState(77.2180);
  const [zoom, setZoom] = useState(14);
  const [gpsStatus, setGpsStatus] = useState('locating');
  const [gpsMessage, setGpsMessage] = useState('Requesting your device location…');
  const [isLiveGpsActive, setIsLiveGpsActive] = useState(false);
  const watchIdRef = useRef(null);

  const [digitalId, setDigitalId] = useState(null);
  const [qrCode, setQrCode] = useState('');
  const [geofences, setGeofences] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [aiRisk, setAiRisk] = useState({ riskScore: 'Low', explanation: 'Acquiring active GPS telemetry...' });
  const [sosStatus, setSosStatus] = useState(null); // 'sending' | 'active'
  const [geofenceViolation, setGeofenceViolation] = useState(null);
  const [myIncidents, setMyIncidents] = useState([]);
  const [itinerary, setItinerary] = useState(null);
  const [showItinModal, setShowItinModal] = useState(false);
  const [itinTitle, setItinTitle] = useState('Delhi Heritage & Safety Route');
  const [itinStart, setItinStart] = useState('India Gate Central Circle');
  const [itinDest, setItinDest] = useState('Connaught Place Inner Circle');

  const t = (key) => translations[lang]?.[key] || translations.en[key] || key;

  const recordLocation = async (newLat, newLng, timestamp) => {
    const parsedLat = Number(newLat);
    const parsedLng = Number(newLng);
    if (!Number.isFinite(parsedLat) || !Number.isFinite(parsedLng) || Math.abs(parsedLat) > 90 || Math.abs(parsedLng) > 180) {
      throw new Error('The device returned invalid coordinates.');
    }

    const res = await API.post('/location/update', {
      user_id: user.id,
      latitude: parsedLat,
      longitude: parsedLng,
      ...(timestamp ? { timestamp } : {})
    });

    if (res.data.triggeredGeofences?.length > 0) {
      setGeofenceViolation(res.data.triggeredGeofences[0]);
    }
  };

  const applyGpsPosition = (pos) => {
    const userLat = pos.coords.latitude;
    const userLng = pos.coords.longitude;
    setLat(userLat);
    setLng(userLng);
    setZoom(15);
    setGpsStatus('real');
    setGpsMessage(`Device location acquired (accuracy ±${Math.round(pos.coords.accuracy || 0)} m).`);
    setGeofenceViolation(null);
    recordLocation(userLat, userLng).catch((err) => console.error('Error sending coordinates:', err));
  };

  const describeGpsError = (error) => {
    if (!window.isSecureContext) return 'Location requires HTTPS (or localhost). Open this app through a secure URL.';
    if (error?.code === error.PERMISSION_DENIED) return 'Location permission was denied. Allow location access in your browser and try again.';
    if (error?.code === error.TIMEOUT) return 'Location request timed out. Check your device location settings and try again.';
    return 'Your device could not determine a location. Check location services and try again.';
  };

  // Real Browser HTML5 Geolocation Detection, with a low-accuracy fallback for desktops.
  const detectRealGps = (allowFallback = true) => {
    if (!navigator.geolocation) {
      setGpsStatus('unsupported');
      setGpsMessage('This browser does not support device location.');
      return;
    }
    if (!window.isSecureContext) {
      setGpsStatus('insecure');
      setGpsMessage('Location requires HTTPS (or localhost). Open this app through a secure URL.');
      return;
    }

    setGpsStatus('locating');
    setGpsMessage('Requesting your device location…');
    navigator.geolocation.getCurrentPosition(
      applyGpsPosition,
      (err) => {
        console.warn("Geolocation permission error or unavailable:", err.message);
        if (err.code === err.TIMEOUT && allowFallback) {
          setGpsMessage('High-accuracy location timed out; trying network location…');
          detectRealGps(false);
          return;
        }
        setGpsStatus(err.code === err.PERMISSION_DENIED ? 'denied' : 'unavailable');
        setGpsMessage(describeGpsError(err));
      },
      { enableHighAccuracy: allowFallback, timeout: allowFallback ? 10000 : 15000, maximumAge: 30000 }
    );
  };

  // Toggle Continuous Real-time GPS Tracking
  const toggleLiveGpsTracking = () => {
    if (isLiveGpsActive) {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      setIsLiveGpsActive(false);
    } else {
      if (!navigator.geolocation) {
        alert(t('gpsDenied'));
        return;
      }
      const id = navigator.geolocation.watchPosition(
        applyGpsPosition,
        (err) => {
          console.warn("Watch position error:", err);
          setIsLiveGpsActive(false);
          setGpsStatus(err.code === err.PERMISSION_DENIED ? 'denied' : 'unavailable');
          setGpsMessage(describeGpsError(err));
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 10000 }
      );
      watchIdRef.current = id;
      setIsLiveGpsActive(true);
      setGpsStatus('locating');
      setGpsMessage('Starting live GPS tracking…');
    }
  };

  // Run GPS auto-detect on initial load
  useEffect(() => {
    detectRealGps();
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

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

  // Fetch Geofences & Itinerary
  useEffect(() => {
    const fetchFences = async () => {
      try {
        const res = await API.get('/geofence/list');
        setGeofences(res.data);
      } catch (e) {
        console.error("Failed to load geofences list", e);
      }
    };
    const fetchItin = async () => {
      try {
        const res = await API.get('/itinerary/my');
        if (res.data) {
          setItinerary(res.data);
          if (res.data.title) setItinTitle(res.data.title);
          if (res.data.start_location) setItinStart(res.data.start_location);
          if (res.data.destination) setItinDest(res.data.destination);
        }
      } catch (e) {
        console.error("Failed to load itinerary", e);
      }
    };
    fetchFences();
    fetchItin();
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
  const updateLocation = async (newLat, newLng, timestamp) => {
    setLat(newLat);
    setLng(newLng);
    setGeofenceViolation(null);

    try {
      await recordLocation(newLat, newLng, timestamp);
    } catch (err) {
      console.error("Error sending coordinates:", err);
    }
  };

  const handleSelectPreset = (preset) => {
    setLat(preset.lat);
    setLng(preset.lng);
    setZoom(preset.zoom);
    setGpsStatus('sim');
    if (isLiveGpsActive && watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
      setIsLiveGpsActive(false);
    }
    updateLocation(preset.lat, preset.lng);
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
    const hazardLat = lat + 0.005;
    const hazardLng = lng + 0.005;
    const pastTime = new Date(Date.now() - 6 * 60 * 1000).toISOString();
    
    setLat(hazardLat);
    setLng(hazardLng);

    try {
      await updateLocation(hazardLat, hazardLng, pastTime);
      
      const resAi = await API.get(`/ai/risk-score/${user.id}`);
      setAiRisk(resAi.data);
    } catch (err) {
      console.error("Signal loss simulation error", err);
    }
  };

  const handleResetSimulation = async () => {
    detectRealGps();
    setGeofenceViolation(null);
  };

  // Fixed Itinerary saving API call (fixed from /api/itinerary/create to /itinerary/create)
  const handleSaveItinerary = async (e) => {
    e.preventDefault();
    try {
      const waypoints = [
        [lng, lat],
        [lng + 0.005, lat + 0.004],
        [lng + 0.010, lat + 0.008]
      ];
      const res = await API.post('/itinerary/create', {
        title: itinTitle,
        start_location: itinStart,
        destination: itinDest,
        waypoints: waypoints
      });
      setItinerary(res.data.itinerary);
      setShowItinModal(false);
    } catch (err) {
      console.error("Failed to save itinerary:", err);
    }
  };

  // Dynamic slider range calculation around current active coordinates
  const latMin = (lat - 0.02).toFixed(4);
  const latMax = (lat + 0.02).toFixed(4);
  const lngMin = (lng - 0.02).toFixed(4);
  const lngMax = (lng + 0.02).toFixed(4);

  return (
    <div className="dashboard-container" id="tourist-dashboard-page">
      {geofenceViolation && (
        <div className="neon-modal-overlay">
          <div className="neon-modal card-warning-border animate-pop">
            <span className="modal-icon">⚠️</span>
            <h2>{t('intrusionTitle')}</h2>
            <p>{t('intrusionBody')} <strong>{geofenceViolation.name}</strong></p>
            <p className="risk-level-alert">Danger Risk Index: <span className="risk-badge-red">{geofenceViolation.risk_level}</span></p>
            <button className="btn-modal-dismiss" onClick={() => setGeofenceViolation(null)}>{t('threatAcknowledge')}</button>
          </div>
        </div>
      )}

      <header className="dash-header">
        <div>
          <h1>{t('touristHub')}</h1>
          <p className="dash-subtitle">{t('touristSubtitle')}</p>
        </div>
        <div className="safety-actions">
          <button 
            onClick={handleSos} 
            className={`btn-sos ${sosStatus === 'active' ? 'sos-alarm' : ''}`}
            disabled={sosStatus === 'sending'}
            id="btn-sos-trigger"
          >
            {sosStatus === 'sending' ? t('sosSending') : sosStatus === 'active' ? t('sosBroadcasting') : t('sosBtn')}
          </button>
        </div>
      </header>

      <div className="dashboard-grid">
        {/* Left Side: Map & Geolocation Simulation */}
        <div className="dash-card main-map-container">
          <div className="card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <h3>{t('activeMap')}</h3>
              <span className={`gps-badge gps-${gpsStatus}`} title={gpsMessage}>
                {gpsStatus === 'real' ? t('gpsStatusReal') : gpsStatus === 'locating' ? t('gpsLocating') : gpsStatus === 'sim' ? t('gpsStatusSim') : 'GPS unavailable'}
              </span>
            </div>
            {gpsStatus !== 'real' && gpsStatus !== 'sim' && (
              <p className="gps-message" role="status">{gpsMessage}</p>
            )}
            
            <div className="map-quick-controls">
              <button 
                onClick={detectRealGps} 
                className="btn-sm btn-gps-locate" 
                title="Detect device GPS location"
                id="btn-real-gps"
              >
                {t('realGpsBtn')}
              </button>
              <button 
                onClick={toggleLiveGpsTracking} 
                className={`btn-sm btn-gps-track ${isLiveGpsActive ? 'tracking-on' : ''}`}
                title="Continuous live GPS streaming"
                id="btn-live-gps-toggle"
              >
                {isLiveGpsActive ? t('gpsTrackingActive') : t('gpsTrackingStart')}
              </button>
            </div>
          </div>

          {/* Quick Location Preset Bar */}
          <div className="location-preset-bar">
            <span className="preset-label">{t('locationPresetLabel')}</span>
            <div className="preset-chips">
              {LOCATION_PRESETS.map(preset => (
                <button
                  key={preset.id}
                  className="preset-chip-btn"
                  onClick={() => handleSelectPreset(preset)}
                >
                  {preset.name}
                </button>
              ))}
            </div>
          </div>

          <div className="map-wrapper-box">
            <MapContainer center={[lat, lng]} zoom={zoom} className="leaflet-map-element">
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              />
              <ChangeMapView center={[lat, lng]} zoom={zoom} />
              <KeepMapSized />
              <MapClickListener onMapClick={(cLat, cLng) => {
                setGpsStatus('sim');
                updateLocation(cLat, cLng);
              }} />
              
              {/* Current Position Marker */}
              <Marker position={[lat, lng]} icon={createDotMarker(sosStatus === 'active' ? '#ef4444' : '#3b82f6', true)}>
                <Popup>
                  <div>
                    <strong>{user.name} ({gpsStatus === 'real' ? 'Real Device GPS' : 'Simulated Position'})</strong><br/>
                    {t('coordLabel')}: {lat.toFixed(5)}, {lng.toFixed(5)}<br/>
                    <small>Click map to test moving into geofences</small>
                  </div>
                </Popup>
              </Marker>

              {/* Geofences Polygons */}
              {geofences.map(gf => {
                const colors = { High: '#ef4444', Medium: '#f59e0b', Low: '#10b981' };
                const coords = getPolygonPositions(gf.polygon_geojson);

                if (coords.length < 3) return null;

                return (
                  <Polygon 
                    key={gf.id} 
                    positions={coords} 
                    pathOptions={{ color: colors[gf.risk_level] || '#aa3bff', fillColor: colors[gf.risk_level], fillOpacity: 0.2 }}
                  >
                    <Popup>
                      <strong>{gf.name}</strong><br/>
                      Danger Risk Index: <span style={{ color: colors[gf.risk_level], fontWeight: 'bold' }}>{gf.risk_level}</span>
                    </Popup>
                  </Polygon>
                );
              })}

              {/* Planned Itinerary Route Polyline */}
              {itinerary && Array.isArray(itinerary.waypoints) && itinerary.waypoints.length > 1 && (
                <Polyline
                  positions={itinerary.waypoints.filter(w => Array.isArray(w) && Number.isFinite(Number(w[0])) && Number.isFinite(Number(w[1]))).map(w => [Number(w[1]), Number(w[0])])}
                  pathOptions={{ color: '#06b6d4', weight: 4, dashArray: '6, 8' }}
                >
                  <Popup>
                    <strong>Planned Itinerary Route</strong><br/>
                    {itinerary.title} ({itinerary.start_location} → {itinerary.destination})
                  </Popup>
                </Polyline>
              )}
            </MapContainer>
          </div>

          {/* Location Simulator Controls */}
          <div className="simulation-sliders">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h4>{t('sliderTitle')}</h4>
              <span className="live-coords-pill">Lat: {lat.toFixed(5)} | Lng: {lng.toFixed(5)}</span>
            </div>
            <p className="sim-helper">{t('sliderHelper')}</p>
            <div className="slider-group">
              <label>Latitude: {lat.toFixed(5)} (Range: {latMin} – {latMax})</label>
              <input 
                type="range" 
                min={latMin} 
                max={latMax} 
                step="0.0001" 
                value={lat} 
                onChange={(e) => {
                  setGpsStatus('sim');
                  updateLocation(parseFloat(e.target.value), lng);
                }}
              />
            </div>
            <div className="slider-group">
              <label>Longitude: {lng.toFixed(5)} (Range: {lngMin} – {lngMax})</label>
              <input 
                type="range" 
                min={lngMin} 
                max={lngMax} 
                step="0.0001" 
                value={lng} 
                onChange={(e) => {
                  setGpsStatus('sim');
                  updateLocation(lat, parseFloat(e.target.value));
                }}
              />
            </div>
          </div>
        </div>

        {/* Right Side: Digital ID, AI Risk, Alerts Feed */}
        <div className="dash-sidebar">
          {/* Trip Itinerary Panel */}
          <div className="dash-card itinerary-card">
            <div className="card-header">
              <h3>{t('tripItinerary')}</h3>
              <button onClick={() => setShowItinModal(true)} className="btn-sm btn-draw-trigger">
                {t('editItinerary')}
              </button>
            </div>
            {itinerary ? (
              <div className="itinerary-content">
                <p><strong>Title:</strong> {itinerary.title}</p>
                <p><strong>Start:</strong> {itinerary.start_location}</p>
                <p><strong>Destination:</strong> {itinerary.destination}</p>
                <div className="itinerary-route-tag">
                  <span className="route-dot text-cyan">●</span> Route Waypoints Visualized on Map
                </div>
              </div>
            ) : (
              <p className="no-alerts">{t('noItinerary')}</p>
            )}
          </div>

          {/* Edit Itinerary Modal */}
          {showItinModal && (
            <div className="neon-modal-overlay">
              <div className="neon-modal card-warning-border animate-pop" style={{ maxWidth: '480px', textAlign: 'left' }}>
                <h2>{t('editItineraryTitle')}</h2>
                <form onSubmit={handleSaveItinerary} className="auth-form" style={{ marginTop: '1rem' }}>
                  <div className="form-group">
                    <label>{t('tripTitle')}</label>
                    <input type="text" value={itinTitle} onChange={(e) => setItinTitle(e.target.value)} required />
                  </div>
                  <div className="form-group">
                    <label>{t('startLocation')}</label>
                    <input type="text" value={itinStart} onChange={(e) => setItinStart(e.target.value)} required />
                  </div>
                  <div className="form-group">
                    <label>{t('destination')}</label>
                    <input type="text" value={itinDest} onChange={(e) => setItinDest(e.target.value)} required />
                  </div>
                  <div className="draw-actions" style={{ marginTop: '1rem' }}>
                    <button type="submit" className="btn-primary">{t('saveItinerary')}</button>
                    <button type="button" className="btn-sm" onClick={() => setShowItinModal(false)}>{t('cancel')}</button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {digitalId && (
            <div className="dash-card digital-id-card">
              <div className="card-header">
                <h3>{t('digitalId')}</h3>
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
                    <span className="hash-label">Cryptographic Hash:</span>
                    <code className="hash-code">{digitalId.id_hash.substring(0, 18)}...</code>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* AI Risk Score Panel */}
          <div className="dash-card ai-risk-card">
            <h3>{t('aiGuard')}</h3>
            <div className="ai-risk-status">
              <div className={`ai-score-display score-${(aiRisk.riskScore || 'low').toLowerCase()}`}>
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
            <h3>{t('aiSimulatorTitle')}</h3>
            <p className="sim-helper">{t('aiSimulatorHelper')}</p>
            <div className="sim-actions-list">
              <button onClick={handleSimulateImmobility} className="btn-sim-action action-immobility">
                {t('simImmobility')}
              </button>
              <button onClick={handleSimulateSignalLoss} className="btn-sim-action action-signalloss">
                {t('simSignalLoss')}
              </button>
              <button onClick={handleResetSimulation} className="btn-sim-action action-reset">
                {t('simReset')}
              </button>
            </div>
          </div>

          {/* My Incidents Tracker Panel */}
          <div className="dash-card my-incidents-card">
            <h3>{t('myIncidents')}</h3>
            <div className="incidents-scroll-box">
              {myIncidents.length === 0 ? (
                <p className="no-alerts">{t('noIncidents')}</p>
              ) : (
                myIncidents.map(inc => (
                  <div key={inc.id} className={`incident-item border-${(inc.ai_risk_score || 'low').toLowerCase()} ${inc.status === 'Resolved' ? 'resolved-dim' : ''}`}>
                    <div className="incident-header">
                      <span className={`risk-badge-${(inc.ai_risk_score || 'low').toLowerCase()}`}>{inc.ai_risk_score}</span>
                      <span className="incident-type">{inc.type.toUpperCase()}</span>
                      <span className="incident-time">{new Date(inc.created_at).toLocaleTimeString()}</span>
                    </div>
                    <div className="incident-body">
                      <p><strong>{t('coordLabel')}:</strong> {Number(inc.latitude).toFixed(5)}, {Number(inc.longitude).toFixed(5)}</p>
                      <p><strong>{t('statusLabel')}:</strong> <span className={`status-label status-${(inc.status || 'open').toLowerCase().replace(' ', '-')}`}>{inc.status}</span></p>
                      {inc.notes && <p className="incident-note-text"><strong>{t('responseNote')}:</strong> {inc.notes}</p>}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Alerts Feed Panel */}
          <div className="dash-card alerts-feed-card">
            <h3>{t('safetyLogs')}</h3>
            <div className="alerts-scroll-box">
              {alerts.length === 0 ? (
                <p className="no-alerts">{t('noBroadcasts')}</p>
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

function AdminDashboard({ user, lang }) {
  const [tourists, setTourists] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [geofences, setGeofences] = useState([]);
  const [adminMapCenter, setAdminMapCenter] = useState([28.6280, 77.2180]);
  const [adminMapZoom, setAdminMapZoom] = useState(13);
  
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

  // Inline notes state: { [incidentId]: noteText }
  const [incidentNotes, setIncidentNotes] = useState({});

  const t = (key) => translations[lang]?.[key] || translations.en[key] || key;

  const fetchTourists = async () => {
    try {
      const res = await API.get('/location/live');
      setTourists(res.data);
      if (res.data.length > 0) {
        // Center on the first active tourist if available
        setAdminMapCenter([res.data[0].latitude, res.data[0].longitude]);
      }
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
    const notes = incidentNotes[id] || '';
    try {
      await API.patch(`/incidents/${id}/status`, { status: newStatus, notes: notes || undefined });
      setIncidentNotes(prev => { const n = { ...prev }; delete n[id]; return n; });
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
      alert("Database tampered! Tourist record has been altered in SQL database. Run Cryptographic Audit to inspect validation failure.");
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
      alert("Database restored to authentic state. Run Cryptographic Audit to verify integrity.");
      setVerificationLog(null);
    } catch (err) {
      console.error(err);
    } finally {
      setIsRestoring(false);
    }
  };

  const handleExportCsv = () => {
    if (incidents.length === 0) return alert("No incidents available to export.");
    const headers = ["ID", "User Name", "Type", "Risk Level", "Latitude", "Longitude", "Status", "Created At", "Resolved At", "Notes"];
    const rows = incidents.map(i => [
      i.id,
      `"${i.user_name || ''}"`,
      i.type,
      i.ai_risk_score,
      i.latitude,
      i.longitude,
      i.status,
      `"${i.created_at || ''}"`,
      `"${i.resolved_at || ''}"`,
      `"${(i.notes || '').replace(/"/g, '""')}"`
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `safetour_incidents_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const addDraftPoint = (dLat, dLng) => {
    setDraftPoints([...draftPoints, [dLng, dLat]]);
  };

  const handleSaveGeofence = async () => {
    if (!newFenceName || draftPoints.length < 3) {
      alert("Please name the fence and draw at least 3 points on the map.");
      return;
    }

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
          <h1>{t('adminTitle')}</h1>
          <p className="dash-subtitle">{t('adminSubtitle')}</p>
        </div>
        <div className="admin-status">
          🟢 National Network Operational
        </div>
      </header>

      {/* Stats & Analytics Command Row */}
      <div className="dashboard-grid admin-stats" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
        <div className="dash-card stat-card">
          <h4>{t('monitoredTourists')}</h4>
          <p className="stat-val">{tourists.length}</p>
          <span className="stat-change text-green">Live GPS updates active</span>
        </div>
        <div className="dash-card stat-card">
          <h4>{t('activeGeofences')}</h4>
          <p className="stat-val">{geofences.length}</p>
          <span className="stat-change text-orange">Polygon risk boundaries</span>
        </div>
        <div className="dash-card stat-card">
          <h4>{t('pendingSos')}</h4>
          <p className="stat-val text-red">
            {incidents.filter(i => i.status !== 'Resolved' && i.type === 'sos').length}
          </p>
          <span className="stat-change text-red">Awaiting dispatch teams</span>
        </div>
        <div className="dash-card stat-card">
          <h4>{t('resolvedIncidents')}</h4>
          <p className="stat-val text-green">
            {incidents.filter(i => i.status === 'Resolved').length}
          </p>
          <span className="stat-change text-green">
            {incidents.length > 0 ? `${Math.round((incidents.filter(i => i.status === 'Resolved').length / incidents.length) * 100)}% Clearance Rate` : 'No incidents logged'}
          </span>
        </div>
      </div>

      <div className="dashboard-grid">
        {/* Left Side: Admin Map and drawing board */}
        <div className="dash-card main-map-container">
          <div className="card-header">
            <h3>{t('centralMap')}</h3>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              {isDrawing ? (
                <span className="draw-instructions animate-pulse">{t('drawingHint')} ({draftPoints.length} vertices)</span>
              ) : (
                <button className="btn-sm btn-draw-trigger" onClick={() => setIsDrawing(true)}>{t('dispatchGeofence')}</button>
              )}
            </div>
          </div>

          {/* Quick Location Preset Bar for Admin */}
          <div className="location-preset-bar">
            <span className="preset-label">{t('locationPresetLabel')}</span>
            <div className="preset-chips">
              {LOCATION_PRESETS.map(preset => (
                <button
                  key={preset.id}
                  className="preset-chip-btn"
                  onClick={() => {
                    setAdminMapCenter([preset.lat, preset.lng]);
                    setAdminMapZoom(preset.zoom);
                  }}
                >
                  {preset.name}
                </button>
              ))}
            </div>
          </div>

          <div className="map-wrapper-box">
            <MapContainer center={adminMapCenter} zoom={adminMapZoom} className="leaflet-map-element">
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              />
              <ChangeMapView center={adminMapCenter} zoom={adminMapZoom} />
              <KeepMapSized />
              <AdminMapEvents onMapClick={addDraftPoint} isDrawing={isDrawing} />

              {/* Render tourists */}
              {tourists.map(tourist => {
                const hasSos = incidents.some(i => i.user_id === tourist.user_id && i.type === 'sos' && i.status !== 'Resolved');
                return (
                  <Marker 
                    key={tourist.id || tourist.user_id} 
                    position={[tourist.latitude, tourist.longitude]}
                    icon={createDotMarker(hasSos ? '#ef4444' : '#10b981', hasSos)}
                  >
                    <Popup>
                      <div>
                        <strong>{tourist.name}</strong><br/>
                        Phone: {tourist.phone}<br/>
                        {t('coordLabel')}: {Number(tourist.latitude).toFixed(5)}, {Number(tourist.longitude).toFixed(5)}<br/>
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
                const coords = getPolygonPositions(gf.polygon_geojson);

                if (coords.length < 3) return null;

                return (
                  <Polygon 
                    key={gf.id} 
                    positions={coords} 
                    pathOptions={{ color: colors[gf.risk_level] || '#aa3bff', fillColor: colors[gf.risk_level], fillOpacity: 0.2 }}
                  >
                    <Popup>
                      <strong>{gf.name}</strong><br/>
                      Danger level: <span style={{ color: colors[gf.risk_level], fontWeight: 'bold' }}>{gf.risk_level}</span>
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
                  placeholder={t('zoneName')}
                  value={newFenceName}
                  onChange={(e) => setNewFenceName(e.target.value)}
                  className="input-draw-name"
                />
                <select value={newFenceRisk} onChange={(e) => setNewFenceRisk(e.target.value)}>
                  <option value="High">{t('riskLevelHigh')}</option>
                  <option value="Medium">{t('riskLevelMedium')}</option>
                  <option value="Low">{t('riskLevelLow')}</option>
                </select>
              </div>
              <div className="draw-actions">
                <button className="btn-primary" onClick={handleSaveGeofence}>{t('saveGeofence')}</button>
                <button className="btn-sm" onClick={() => { setDraftPoints([]); setIsDrawing(false); }}>{t('cancel')}</button>
              </div>
            </div>
          )}
        </div>

        {/* Right Side: Incident Logs & Blockchain Ledger verification */}
        <div className="dash-sidebar">
          {/* Active Incidents Command */}
          <div className="dash-card admin-incidents-card">
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3>Active Incident Dispatch</h3>
              <button onClick={handleExportCsv} className="btn-sm btn-export-csv">
                {t('exportCsv')}
              </button>
            </div>
            <div className="incidents-scroll-box">
              {incidents.length === 0 ? (
                <p className="no-alerts">{t('noIncidents')}</p>
              ) : (
                incidents.map(inc => (
                  <div key={inc.id} className={`incident-item border-${(inc.ai_risk_score || 'low').toLowerCase()} ${inc.status === 'Resolved' ? 'resolved-dim' : ''}`}>
                    <div className="incident-header">
                      <span className={`risk-badge-${(inc.ai_risk_score || 'low').toLowerCase()}`}>{inc.ai_risk_score}</span>
                      <span className="incident-type">{inc.type.toUpperCase()}</span>
                      <span className="incident-time">{new Date(inc.created_at).toLocaleTimeString()}</span>
                    </div>
                    <div className="incident-body">
                      <p><strong>User:</strong> {inc.user_name} ({inc.user_phone || 'N/A'})</p>
                      <p><strong>{t('coordLabel')}:</strong> {Number(inc.latitude).toFixed(5)}, {Number(inc.longitude).toFixed(5)}</p>
                      <p><strong>{t('statusLabel')}:</strong> <span className={`status-label status-${(inc.status || 'open').toLowerCase().replace(' ', '-')}`}>{inc.status}</span></p>
                      {inc.notes && <p className="incident-note-text"><strong>{t('responseNote')}:</strong> {inc.notes}</p>}
                    </div>
                    {inc.status !== 'Resolved' && (
                      <div className="incident-actions">
                        <textarea
                          className="incident-note-input"
                          placeholder="Response note (e.g. Patrol team dispatched)..."
                          rows={2}
                          value={incidentNotes[inc.id] || ''}
                          onChange={(e) => setIncidentNotes(prev => ({ ...prev, [inc.id]: e.target.value }))}
                        />
                        <div className="incident-btns-row">
                          {inc.status === 'Open' && (
                            <button className="btn-sm btn-dispatch" onClick={() => handleUpdateStatus(inc.id, 'In Progress')}>{t('dispatchBtn')}</button>
                          )}
                          <button className="btn-sm btn-resolve" onClick={() => handleUpdateStatus(inc.id, 'Resolved')}>{t('resolveBtn')}</button>
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Authority Verification Terminal */}
          <div className="dash-card qr-verification-card">
            <h3>{t('authorityTerminal')}</h3>
            <p className="sim-helper">{t('authorityHelper')}</p>
            <div className="verification-form">
              <textarea 
                rows="2" 
                placeholder='Paste QR Code JSON payload here...' 
                value={qrPayloadInput} 
                onChange={(e) => setQrPayloadInput(e.target.value)}
                className="qr-textarea"
              />
              <button onClick={handleVerifyQrCode} className="btn-primary btn-verify-qr">
                {t('verifyQrBtn')}
              </button>
            </div>
            {qrVerificationResult && (
              <div className="verification-result animate-pop">
                {qrVerificationResult.verified ? (
                  <div className="result-alert result-success">
                    <span className="badge-icon">✅</span>
                    <div>
                      <h4>AUTHENTIC DIGITAL ID</h4>
                      <p><strong>Name:</strong> {qrVerificationResult.user?.name}</p>
                      <p><strong>Passport/ID:</strong> {qrVerificationResult.user?.id_proof_number}</p>
                      <p><strong>Status:</strong> Valid until {new Date(qrVerificationResult.valid_until).toLocaleDateString()}</p>
                      <code className="signature-code">Sig status: SECURE & VERIFIED</code>
                    </div>
                  </div>
                ) : (
                  <div className="result-alert result-danger">
                    <span className="badge-icon">❌</span>
                    <div>
                      <h4>VERIFICATION FAILED</h4>
                      <p className="error-text">{qrVerificationResult.error}</p>
                      <code className="signature-code">Sig status: COMPROMISED / INVALID</code>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Ledger Cryptographic Audit */}
          <div className="dash-card blockchain-card">
            <div className="card-header">
              <h3>{t('auditLedgerTitle')}</h3>
              <button 
                className="btn-sm btn-audit" 
                onClick={verifyLedger}
                disabled={isVerifying}
              >
                {isVerifying ? t('auditingBtn') : t('auditBtn')}
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
              <p className="no-alerts">Verify simulated cryptographic identity chains stored in database.</p>
            )}

            <div className="tamper-simulation-controls">
              <span className="control-label">Attack Simulator:</span>
              <div className="control-buttons">
                <button 
                  onClick={handleTamperDatabase} 
                  className="btn-sm btn-tamper-db" 
                  disabled={isTampering}
                >
                  {isTampering ? 'Altering...' : t('tamperDb')}
                </button>
                <button 
                  onClick={handleRestoreDatabase} 
                  className="btn-sm btn-repair-db" 
                  disabled={isRestoring}
                >
                  {isRestoring ? 'Restoring...' : t('repairDb')}
                </button>
              </div>
            </div>
          </div>

          {/* Geofence Boundary Registry */}
          <div className="dash-card geofence-registry-card">
            <h3>{t('geofenceRegistry')}</h3>
            <div className="registry-list-box">
              {geofences.length === 0 ? (
                <p className="no-alerts">No geofences defined.</p>
              ) : (
                <table className="geofence-table">
                  <thead>
                    <tr>
                      <th>{t('zoneColumn')}</th>
                      <th>{t('riskColumn')}</th>
                      <th>{t('actionColumn')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {geofences.map(gf => (
                      <tr key={gf.id}>
                        <td><strong>{gf.name}</strong></td>
                        <td><span className={`risk-badge-${(gf.risk_level || 'low').toLowerCase()}`}>{gf.risk_level}</span></td>
                        <td>
                          <button onClick={() => handleDeleteGeofence(gf.id)} className="btn-sm btn-delete-gf">{t('delete')}</button>
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
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark');
  const [lang, setLang] = useState(() => localStorage.getItem('lang') || 'en');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  const changeLang = (newLang) => {
    setLang(newLang);
    localStorage.setItem('lang', newLang);
  };

  // Auto login from localstorage if token exists
  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch (e) {
        localStorage.removeItem('user');
      }
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
        <Navigation user={user} onLogout={handleLogout} theme={theme} onToggleTheme={toggleTheme} lang={lang} onChangeLang={changeLang} />
        <main className="app-content">
          <ErrorBoundary>
            <Routes>
              <Route 
                path="/login" 
                element={user ? <Navigate to={user.role === 'admin' ? '/admin-dashboard' : '/tourist-dashboard'} replace /> : <Login onLoginSuccess={handleLoginSuccess} lang={lang} />} 
              />
              <Route 
                path="/register" 
                element={user ? <Navigate to={user.role === 'admin' ? '/admin-dashboard' : '/tourist-dashboard'} replace /> : <Register onLoginSuccess={handleLoginSuccess} lang={lang} />} 
              />
              <Route 
                path="/tourist-dashboard" 
                element={user && user.role === 'tourist' ? <TouristDashboard user={user} lang={lang} /> : <Navigate to="/login" replace />} 
              />
              <Route 
                path="/admin-dashboard" 
                element={user && user.role === 'admin' ? <AdminDashboard user={user} lang={lang} /> : <Navigate to="/login" replace />} 
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

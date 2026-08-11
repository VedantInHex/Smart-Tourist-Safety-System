import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link } from 'react-router-dom';
import './App.css';

function Navigation() {
  return (
    <nav className="navbar" id="app-nav">
      <div className="nav-brand">
        <span className="brand-icon">🛡️</span> SafeTour AI
      </div>
      <div className="nav-links">
        <Link to="/login" id="nav-login" className="nav-link">Login</Link>
        <Link to="/register" id="nav-register" className="nav-link">Register</Link>
        <Link to="/tourist-dashboard" id="nav-tourist" className="nav-link">Tourist Portal</Link>
        <Link to="/admin-dashboard" id="nav-admin" className="nav-link">Admin Panel</Link>
      </div>
    </nav>
  );
}

function Login() {
  return (
    <div className="auth-container" id="login-page">
      <div className="auth-card">
        <h2>Welcome Back</h2>
        <p className="auth-subtitle">Real-time safety routing and emergency dispatch</p>
        <form className="auth-form" onSubmit={(e) => e.preventDefault()}>
          <div className="form-group">
            <label htmlFor="login-email">Email Address</label>
            <input type="email" id="login-email" placeholder="you@example.com" required />
          </div>
          <div className="form-group">
            <label htmlFor="login-password">Password</label>
            <input type="password" id="login-password" placeholder="••••••••" required />
          </div>
          <button type="submit" id="btn-login-submit" className="btn-primary">Sign In</button>
        </form>
        <p className="auth-footer">
          Don't have an account? <Link to="/register" id="link-goto-register">Create Account</Link>
        </p>
      </div>
    </div>
  );
}

function Register() {
  return (
    <div className="auth-container" id="register-page">
      <div className="auth-card">
        <h2>Join SafeTour</h2>
        <p className="auth-subtitle">Instant geofencing alerts and emergency help</p>
        <form className="auth-form" onSubmit={(e) => e.preventDefault()}>
          <div className="form-group">
            <label htmlFor="reg-name">Full Name</label>
            <input type="text" id="reg-name" placeholder="John Doe" required />
          </div>
          <div className="form-group">
            <label htmlFor="reg-email">Email Address</label>
            <input type="email" id="reg-email" placeholder="you@example.com" required />
          </div>
          <div className="form-group">
            <label htmlFor="reg-password">Password</label>
            <input type="password" id="reg-password" placeholder="••••••••" required />
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

function TouristDashboard() {
  return (
    <div className="dashboard-container" id="tourist-dashboard-page">
      <header className="dash-header">
        <div>
          <h1>Tourist Dashboard</h1>
          <p className="dash-subtitle">Real-Time Travel Safeguards</p>
        </div>
        <div className="safety-badge status-secure">✓ GPS Monitoring Active</div>
      </header>

      <div className="dashboard-grid">
        <div className="dash-card main-map-placeholder">
          <div className="card-header">
            <h3>Safety Geofence Map</h3>
            <span className="card-tag">Interactive</span>
          </div>
          <div className="map-dummy">
            <div className="map-overlay">
              <span className="pulse-indicator"></span>
              <h4>Leaflet Map Placeholder</h4>
              <p>Geofences, danger zones, and tourist locations will be displayed here.</p>
            </div>
          </div>
        </div>

        <div className="dash-card sidebar-alerts">
          <div className="card-header">
            <h3>Recent Safety Alerts</h3>
            <span className="card-tag alert-badge">Live Updates</span>
          </div>
          <div className="alerts-list">
            <div className="alert-item hazard">
              <span className="alert-icon">⚠️</span>
              <div className="alert-content">
                <h4>Extreme Weather</h4>
                <p>Heavy flash floods alert in Downtown Valley. Avoid river banks.</p>
                <span className="alert-time">2 mins ago</span>
              </div>
            </div>
            <div className="alert-item safe">
              <span className="alert-icon">ℹ️</span>
              <div className="alert-content">
                <h4>System Check</h4>
                <p>Secure connection verified with Local Command Center.</p>
                <span className="alert-time">15 mins ago</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function AdminDashboard() {
  return (
    <div className="dashboard-container" id="admin-dashboard-page">
      <header className="dash-header">
        <div>
          <h1>Admin Panel</h1>
          <p className="dash-subtitle">Geofence Dispatch & User Oversight</p>
        </div>
        <div className="admin-status">COMMAND CENTRE ONLINE</div>
      </header>

      <div className="dashboard-grid admin-stats">
        <div className="dash-card stat-card">
          <h4>Tracked Users</h4>
          <p className="stat-val">1,248</p>
          <span className="stat-change text-green">↑ +8% active now</span>
        </div>
        <div className="dash-card stat-card">
          <h4>Active Geofences</h4>
          <p className="stat-val">12</p>
          <span className="stat-change text-orange">3 hazard regions</span>
        </div>
        <div className="dash-card stat-card">
          <h4>API Response</h4>
          <p className="stat-val">42ms</p>
          <span className="stat-change text-green">System Healthy</span>
        </div>
      </div>

      <div className="dash-section">
        <div className="dash-card full-width">
          <div className="card-header">
            <h3>Active Danger Geofences</h3>
            <button className="btn-sm" id="btn-create-fence">Add New Geofence</button>
          </div>
          <div className="table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Zone ID</th>
                  <th>Location/Name</th>
                  <th>Risk Level</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>#GF-8092</td>
                  <td>East Coast Storm Tide</td>
                  <td><span className="risk-level risk-high">High</span></td>
                  <td>Active</td>
                  <td><button className="btn-table-action" id="btn-manage-fence-1">Manage</button></td>
                </tr>
                <tr>
                  <td>#GF-7811</td>
                  <td>Downtown Riot Zone</td>
                  <td><span className="risk-level risk-critical">Critical</span></td>
                  <td>Suspended</td>
                  <td><button className="btn-table-action" id="btn-manage-fence-2">Manage</button></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function App() {
  return (
    <Router>
      <div className="app-wrapper">
        <Navigation />
        <main className="app-content">
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/tourist-dashboard" element={<TouristDashboard />} />
            <Route path="/admin-dashboard" element={<AdminDashboard />} />
            <Route path="/" element={<Navigate to="/login" replace />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;

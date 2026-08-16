# SafeTour AI 🛡️

> A smart tourist safety and emergency-response platform built to help tourists stay safe and help authorities respond faster.

## Problem

Tourists traveling in unfamiliar places may face emergencies, unsafe zones, or communication delays. During an incident, responders often need the tourist’s exact location, identity, emergency context, and travel route immediately.

SafeTour AI brings these safety workflows into one platform.

## Solution

SafeTour AI connects tourists and authorities through real-time GPS tracking, SOS alerts, geofencing, digital identity verification, and incident management.

A tourist can share their live location, receive alerts when entering danger zones, plan a trip, and trigger an SOS request. Authorities can monitor active tourists, manage incidents, draw risk zones, and verify digital IDs from a central dashboard.

## Features

### Tourist Dashboard

- Real-time GPS location tracking
- Interactive live map using Leaflet
- Continuous live GPS tracking
- One-tap SOS emergency button
- Geofence alerts when entering high- or medium-risk zones
- Safety-risk score based on:
  - Risk-zone entry
  - Inactivity
  - Repeated immobility
  - Lost location signals
- QR-based digital tourist ID
- Trip itinerary planning and route visualization
- Safety alerts and personal incident tracker
- Multi-language support
- Light and dark themes

### Authority Dashboard

- Live tourist-location command map
- SOS and geofence incident monitoring
- Draw and manage polygon-based danger zones
- Assign Low, Medium, or High risk levels to geofences
- Dispatch, update, and resolve incidents
- Add response notes to incidents
- Export incidents as CSV reports
- Verify QR-based tourist identities
- Hash-linked identity-ledger audit
- Tamper-detection demonstration for digital identity records

## Technology Stack

| Category | Technology |
| --- | --- |
| Frontend | React, Vite, React Router |
| Maps | Leaflet, React Leaflet |
| Backend | Node.js, Express |
| Database | PostgreSQL |
| Authentication | JWT, bcrypt |
| API Communication | Axios |
| Digital Identity | QR codes, SHA-256 hash-linked records |
| Deployment | Vercel frontend + Render/Node backend |

## DEMO ACCOUNTS

Tourist account
Email: tourist@safetour.com
Password: tourist123

Admin account
Email: admin@safetour.com
Password: admin123


## Project Structure

```text
tourist-safety-system/
├── client/                 # React + Vite frontend
├── server/                 # Express API and database logic
├── deployment/             # HTTPS/Nginx deployment configuration
└── README.md


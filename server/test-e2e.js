const BASE_URL = 'http://localhost:5000/api';

async function runTests() {
  console.log('🚀 Starting SafeTour AI End-to-End Test Suite...\n');
  let failures = 0;
  let passes = 0;

  function assert(condition, testName, extraInfo = '') {
    if (condition) {
      console.log(`  ✅ PASS: ${testName}`);
      passes++;
    } else {
      console.error(`  ❌ FAIL: ${testName} ${extraInfo}`);
      failures++;
    }
  }

  async function req(url, options = {}) {
    const res = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {})
      },
      body: options.body ? JSON.stringify(options.body) : undefined
    });
    const data = await res.json().catch(() => ({}));
    return { status: res.status, data };
  }

  try {
    // 1. Health Check
    const health = await req('http://localhost:5000/health');
    assert(health.status === 200 && health.data.status === 'ok', 'Server Health Check');

    // 2. Admin Login
    const adminLogin = await req(`${BASE_URL}/auth/login`, {
      method: 'POST',
      body: { email: 'admin@safetour.com', password: 'admin123' }
    });
    assert(adminLogin.status === 200 && adminLogin.data.token, 'Admin Login Authenticated');
    const adminToken = adminLogin.data.token;
    const adminHeaders = { Authorization: `Bearer ${adminToken}` };

    // 3. Tourist Login
    const touristLogin = await req(`${BASE_URL}/auth/login`, {
      method: 'POST',
      body: { email: 'tourist@safetour.com', password: 'tourist123' }
    });
    assert(touristLogin.status === 200 && touristLogin.data.token, 'Tourist Login Authenticated');
    const touristToken = touristLogin.data.token;
    const touristUser = touristLogin.data.user;
    const touristHeaders = { Authorization: `Bearer ${touristToken}` };

    // 4. Digital ID Retrieval
    const digitalIdRes = await req(`${BASE_URL}/digital-id/${touristUser.id}`, {
      headers: touristHeaders
    });
    assert(digitalIdRes.status === 200 && digitalIdRes.data.digitalId?.id_hash, 'Digital ID & QR Hash Retrieved');
    const qrPayload = {
      userId: touristUser.id,
      hash: digitalIdRes.data.digitalId.id_hash,
      name: touristUser.name,
      email: touristUser.email
    };

    // 5. Digital ID QR Verification by Admin
    const verifyQrRes = await req(`${BASE_URL}/digital-id/verify`, {
      method: 'POST',
      headers: adminHeaders,
      body: qrPayload
    });
    assert(verifyQrRes.data.verified === true, 'Admin Authority QR Verification');

    // 6. Blockchain Ledger Chain Audit
    const verifyChainRes = await req(`${BASE_URL}/digital-id/chain/verify`, {
      headers: adminHeaders
    });
    assert(verifyChainRes.data.verified === true, 'Blockchain Ledger Cryptographic Integrity Audit');

    // 7. Geofence List Retrieval
    const geofencesRes = await req(`${BASE_URL}/geofence/list`, {
      headers: touristHeaders
    });
    assert(geofencesRes.status === 200 && geofencesRes.data.length > 0, `Geofence Registry Listing (${geofencesRes.data.length} zones found)`);

    // 8. Tourist Location Update in Safe Zone (India Gate / Delhi)
    const locUpdateSafe = await req(`${BASE_URL}/location/update`, {
      method: 'POST',
      headers: touristHeaders,
      body: {
        user_id: touristUser.id,
        latitude: 28.6139,
        longitude: 77.2090
      }
    });
    assert(locUpdateSafe.status === 200 && locUpdateSafe.data.message, 'Safe Zone Location Update');

    // 9. Tourist Location Update triggering Danger Geofence in Goa ([73.750, 15.550])
    const locUpdateDanger = await req(`${BASE_URL}/location/update`, {
      method: 'POST',
      headers: touristHeaders,
      body: {
        user_id: touristUser.id,
        latitude: 15.5500,
        longitude: 73.7500
      }
    });
    assert(locUpdateDanger.data.triggeredGeofences && locUpdateDanger.data.triggeredGeofences.length > 0, 
      'Geofence Intrusion Point-In-Polygon Triggered', 
      `Zones: ${JSON.stringify(locUpdateDanger.data.triggeredGeofences?.map(g => g.name))}`);

    // 10. Tourist SOS Emergency Distress Signal
    const sosRes = await req(`${BASE_URL}/incidents/sos`, {
      method: 'POST',
      headers: touristHeaders,
      body: {
        user_id: touristUser.id,
        latitude: 15.5500,
        longitude: 73.7500
      }
    });
    assert(sosRes.status === 201 && sosRes.data.incident?.type === 'sos', 'Emergency SOS Distress Broadcast Triggered');
    const createdIncidentId = sosRes.data.incident.id;

    // 11. Admin Incidents Query
    const incidentsRes = await req(`${BASE_URL}/incidents`, {
      headers: adminHeaders
    });
    assert(incidentsRes.status === 200 && incidentsRes.data.some(i => i.id === createdIncidentId), 'Admin Incident Dispatch Command Room Retrieval');

    // 12. Admin Update Incident Status & Response Note
    const updateIncRes = await req(`${BASE_URL}/incidents/${createdIncidentId}/status`, {
      method: 'PATCH',
      headers: adminHeaders,
      body: {
        status: 'In Progress',
        notes: 'Emergency Coast Guard Patrol Vessel Dispatched.'
      }
    });
    assert(updateIncRes.status === 200 && updateIncRes.data.incident.status === 'In Progress' && updateIncRes.data.incident.notes, 'Admin Status Update with Response Note');

    // 13. Tourist Incident Tracker
    const myIncidentsRes = await req(`${BASE_URL}/incidents/my`, {
      headers: touristHeaders
    });
    assert(myIncidentsRes.status === 200 && myIncidentsRes.data.length > 0, 'Tourist "My Incident Tracker" Query');

    // 14. Tourist Alerts Feed
    const alertsRes = await req(`${BASE_URL}/incidents/alerts/${touristUser.id}`, {
      headers: touristHeaders
    });
    assert(alertsRes.status === 200 && alertsRes.data.length > 0, `Tourist Safety Broadcast Alerts Feed (${alertsRes.data.length} alerts)`);

    // 15. AI Risk Score Engine Assessment
    const aiRes = await req(`${BASE_URL}/ai/risk-score/${touristUser.id}`, {
      headers: touristHeaders
    });
    assert(aiRes.status === 200 && aiRes.data.riskScore, `AI Safety Guard Assessment (Score: ${aiRes.data.riskScore})`);

    // 16. Trip Itinerary Creation
    const itinCreateRes = await req(`${BASE_URL}/itinerary/create`, {
      method: 'POST',
      headers: touristHeaders,
      body: {
        title: 'Goa Coastal Exploration Safeguard Route',
        start_location: 'Panaji Heritage Center',
        destination: 'Baga Lighthouse Point',
        waypoints: [
          [73.8278, 15.4909],
          [73.7700, 15.5300],
          [73.7550, 15.5550]
        ]
      }
    });
    assert(itinCreateRes.status === 201 && itinCreateRes.data.itinerary?.title, 'Trip Itinerary Route Safeguard Saved');

    // 17. Trip Itinerary Retrieval
    const itinGetRes = await req(`${BASE_URL}/itinerary/my`, {
      headers: touristHeaders
    });
    assert(itinGetRes.status === 200 && itinGetRes.data.title === 'Goa Coastal Exploration Safeguard Route', 'Trip Itinerary Retrieval');

    // 18. Admin Geofence Creation & Deletion
    const newGeofenceRes = await req(`${BASE_URL}/geofence/create`, {
      method: 'POST',
      headers: adminHeaders,
      body: {
        name: 'Temporary River Surge Perimeter (Rishikesh, India)',
        polygon_geojson: {
          type: 'Polygon',
          coordinates: [[[78.30, 30.10], [78.32, 30.10], [78.32, 30.08], [78.30, 30.08], [78.30, 30.10]]]
        },
        risk_level: 'High',
        created_by: adminLogin.data.user.id
      }
    });
    assert(newGeofenceRes.status === 201 && newGeofenceRes.data.geofence?.id, 'Admin Custom Geofence Dispatch');
    const createdGfId = newGeofenceRes.data.geofence.id;

    const delGeofenceRes = await req(`${BASE_URL}/geofence/${createdGfId}`, {
      method: 'DELETE',
      headers: adminHeaders
    });
    assert(delGeofenceRes.status === 200, 'Admin Geofence Deletion');

    // 19. Tamper Detection Demo Trigger & Restore
    await req(`${BASE_URL}/auth/test/tamper`, {
      method: 'POST',
      headers: adminHeaders,
      body: { userId: touristUser.id }
    });
    const tamperedAudit = await req(`${BASE_URL}/digital-id/chain/verify`, {
      headers: adminHeaders
    });
    assert(tamperedAudit.data.verified === false, 'Blockchain Tamper Detection Correctly Flags Compromised Record');

    await req(`${BASE_URL}/auth/test/restore`, {
      method: 'POST',
      headers: adminHeaders,
      body: { userId: touristUser.id }
    });
    const restoredAudit = await req(`${BASE_URL}/digital-id/chain/verify`, {
      headers: adminHeaders
    });
    assert(restoredAudit.data.verified === true, 'Blockchain Ledger Restored to 100% Authentic State');

    console.log(`\n========================================`);
    console.log(`🎯 Test Summary: ${passes} Passed, ${failures} Failed`);
    console.log(`========================================\n`);

    if (failures === 0) {
      console.log('🌟 ALL 19 END-TO-END TESTS PASSED SUCCESSFULLY! 🌟');
      process.exit(0);
    } else {
      process.exit(1);
    }

  } catch (error) {
    console.error('Fatal Test Execution Error:', error);
    process.exit(1);
  }
}

runTests();

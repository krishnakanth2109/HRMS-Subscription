const BASE_URL = 'http://localhost:5000/api';

const randomString = () => Math.random().toString(36).substring(7);

async function runTests() {
  console.log('--- STARTING BACKEND INTEGRATION TESTS WITH LATENCY REPORT ---\n');
  const dummyEmail = `test_${randomString()}@example.com`;
  const dummyPassword = 'password123';
  let token = '';
  
  const results = [];

  try {
    // 1. REGISTER CUSTOMER
    console.log(`[1/5] Registering Customer: ${dummyEmail}...`);
    let start = performance.now();
    let res = await fetch(`${BASE_URL}/users/customer/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test Customer',
        email: dummyEmail,
        phone: '1234567890',
        password: dummyPassword
      })
    });
    let data = await res.json();
    let end = performance.now();
    let latency = (end - start).toFixed(2);
    if (!res.ok) throw new Error(data.message || 'Failed to register');
    console.log(`  ✓ Success - Latency: ${latency} ms\n`);
    results.push({ Route: 'POST /users/customer/register', LatencyMs: latency, Status: 'Success' });

    // 2. LOGIN CUSTOMER
    console.log(`[2/5] Logging in Customer...`);
    start = performance.now();
    res = await fetch(`${BASE_URL}/users/customer/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: dummyEmail, password: dummyPassword })
    });
    data = await res.json();
    end = performance.now();
    latency = (end - start).toFixed(2);
    if (!res.ok) throw new Error(data.message || 'Failed to login');
    token = data.data.token;
    console.log(`  ✓ Success - Latency: ${latency} ms\n`);
    results.push({ Route: 'POST /users/customer/login', LatencyMs: latency, Status: 'Success' });

    // 3. FETCH PROFILE BALANCES
    console.log(`[3/5] Fetching Initial Profile Balances...`);
    start = performance.now();
    res = await fetch(`${BASE_URL}/profile/balances`, {
      method: 'GET',
      headers: { 'x-auth-token': token }
    });
    data = await res.json();
    end = performance.now();
    latency = (end - start).toFixed(2);
    if (!res.ok) throw new Error(data.message || 'Failed to fetch balances');
    console.log(`  ✓ Success - Latency: ${latency} ms\n`);
    results.push({ Route: 'GET /profile/balances', LatencyMs: latency, Status: 'Success' });

    // 4. TOP-UP WALLET
    console.log(`[4/5] Topping up Wallet with ₹500...`);
    start = performance.now();
    res = await fetch(`${BASE_URL}/profile/wallet/add`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-auth-token': token },
      body: JSON.stringify({ amount: 500, paymentMethod: 'UPI' })
    });
    data = await res.json();
    end = performance.now();
    latency = (end - start).toFixed(2);
    if (!res.ok) throw new Error(data.message || 'Failed to top-up wallet');
    console.log(`  ✓ Success - Latency: ${latency} ms\n`);
    results.push({ Route: 'POST /profile/wallet/add', LatencyMs: latency, Status: 'Success' });

    // 5. SUBSCRIBE TO POWER PASS
    console.log(`[5/5] Subscribing to Power Pass (Pro)...`);
    start = performance.now();
    res = await fetch(`${BASE_URL}/profile/power-pass/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-auth-token': token },
      body: JSON.stringify({ tier: 'Pro', durationMonths: 3 })
    });
    data = await res.json();
    end = performance.now();
    latency = (end - start).toFixed(2);
    if (!res.ok) throw new Error(data.message || 'Failed to subscribe to Power Pass');
    console.log(`  ✓ Success - Latency: ${latency} ms\n`);
    results.push({ Route: 'POST /profile/power-pass/subscribe', LatencyMs: latency, Status: 'Success' });

    console.log('✅ ALL TESTS PASSED SUCCESSFULLY! The backend is fully functional.\n');

  } catch (err) {
    console.error(`❌ TEST FAILED: ${err.message}\n`);
    results.push({ Route: 'Failed at step', Error: err.message, Status: 'Failed' });
  }

  console.log('--- LATENCY REPORT ---');
  console.table(results);
}

runTests();

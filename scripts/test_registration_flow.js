const http = require('http');

function request(options, data) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, headers: res.headers, data: JSON.parse(body) });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, raw: body });
        }
      });
    });
    req.on('error', reject);
    if (data) req.write(typeof data === 'string' ? data : JSON.stringify(data));
    req.end();
  });
}

async function runTests() {
  console.log('--- TESTING ENROLLMENT VERIFICATION & REGISTRATION FLOW ---');

  // Test 1: Verify valid 10-digit student from docx
  console.log('\n[Test 1] Verify valid student from docx (2600106857 - Azmat Hussain)');
  const res1 = await request({
    hostname: 'localhost',
    port: 3001,
    path: '/api/auth/verify-enrollment?enrollmentNo=2600106857',
    method: 'GET'
  });
  console.log(`Status: ${res1.status}`);
  console.log('Response:', res1.data);

  // Test 2: Verify non-10 digit input
  console.log('\n[Test 2] Verify non-10 digit input (12345)');
  const res2 = await request({
    hostname: 'localhost',
    port: 3001,
    path: '/api/auth/verify-enrollment?enrollmentNo=12345',
    method: 'GET'
  });
  console.log(`Status: ${res2.status}`);
  console.log('Response:', res2.data);

  // Test 3: Verify 10-digit number not in roster
  console.log('\n[Test 3] Verify 10-digit number not in roster (9999999999)');
  const res3 = await request({
    hostname: 'localhost',
    port: 3001,
    path: '/api/auth/verify-enrollment?enrollmentNo=9999999999',
    method: 'GET'
  });
  console.log(`Status: ${res3.status}`);
  console.log('Response:', res3.data);

  // Test 4: Register valid resident student (Azmat Hussain)
  console.log('\n[Test 4] Register resident student Azmat Hussain');
  const regPayload = {
    enrollmentNo: '2600106857',
    campus: 'Phase I',
    gender: 'Boy',
    hostel: 'Hall 1',
    room: 'A018',
    name: 'Azmat Hussain',
    email: 'azmathussain@iul.ac.in',
    phone: '9555042232',
    password: 'password123'
  };

  const res4 = await request({
    hostname: 'localhost',
    port: 3001,
    path: '/api/auth/register',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, regPayload);
  console.log(`Status: ${res4.status}`);
  console.log('Response:', res4.data);

  // Test 5: Verify already registered detection
  console.log('\n[Test 5] Verify Azmat Hussain now detects already registered');
  const res5 = await request({
    hostname: 'localhost',
    port: 3001,
    path: '/api/auth/verify-enrollment?enrollmentNo=2600106857',
    method: 'GET'
  });
  console.log(`Status: ${res5.status}`);
  console.log('Response:', res5.data);

  // Test 6: Student Login with 10-digit enrollment number
  console.log('\n[Test 6] Login with newly registered enrollment number 2600106857');
  const res6 = await request({
    hostname: 'localhost',
    port: 3001,
    path: '/api/auth/student-login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { enrollmentNo: '2600106857', password: 'password123' });
  console.log(`Status: ${res6.status}`);
  console.log('Response:', res6.data);

  // Test 7: Staff Login with docx official supervisors
  console.log('\n[Test 7] Login with docx official supervisor Zahid Raza (zahidraza@iul.ac.in)');
  const res7 = await request({
    hostname: 'localhost',
    port: 3001,
    path: '/api/auth/staff-login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { email: 'zahidraza@iul.ac.in', password: 'super123' });
  console.log(`Status: ${res7.status}`);
  console.log('Response:', res7.data);

  console.log('\n[Test 8] Login with docx official supervisor Sidra Jameel (sidraj@iul.ac.in)');
  const res8 = await request({
    hostname: 'localhost',
    port: 3001,
    path: '/api/auth/staff-login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { email: 'sidraj@iul.ac.in', password: 'super123' });
  console.log(`Status: ${res8.status}`);
  console.log('Response:', res8.data);

  console.log('\n--- ALL BACKEND TESTS COMPLETED ---');
}

runTests().catch(console.error);

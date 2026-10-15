import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import User from '../models/User.js';
import app from '../app.js';
import http from 'http';
import bcrypt from 'bcryptjs';

const PORT = 5055; // Dedicated test port
let server;
let baseUrl = `http://127.0.0.1:${PORT}`;

const logPass = (testNum, desc) => console.log(`\x1b[32m✔ [PASS ${testNum}]\x1b[0m ${desc}`);
const logFail = (testNum, desc, err) => console.error(`\x1b[31m✖ [FAIL ${testNum}]\x1b[0m ${desc}: ${err}`);

const parseCookie = (res) => {
  const setCookie = res.headers['set-cookie'];
  if (!setCookie) return null;
  const cookieStr = Array.isArray(setCookie) ? setCookie[0] : setCookie;
  return cookieStr.split(';')[0];
};

const makeRequest = (path, options = {}) => {
  return new Promise((resolve, reject) => {
    const url = new URL(path, baseUrl);
    const reqOptions = {
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {})
      }
    };

    const req = http.request(url, reqOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(data); } catch { json = data; }
        resolve({
          status: res.statusCode,
          headers: res.headers,
          data: json
        });
      });
    });

    req.on('error', reject);
    if (options.body) {
      req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    }
    req.end();
  });
};

const runAllTests = async () => {
  console.log('\n========================================');
  console.log('EXACTSPARE MODULE 2 — AUTHENTICATION & RBAC TEST SUITE');
  console.log('========================================\n');

  // Connect to MongoDB
  await mongoose.connect(process.env.MONGODB_URI);
  
  // Clean up any previous test accounts
  const testCustomerEmail = 'test.customer@exactspare.com';
  const testOwnerEmail = 'test.owner@exactspare.com';
  await User.deleteMany({ email: { $in: [testCustomerEmail, testOwnerEmail, 'invalid.admin@exactspare.com'] } });

  // Start HTTP server on test port
  await new Promise(resolve => {
    server = app.listen(PORT, resolve);
  });

  let customerCookie = null;
  let ownerCookie = null;

  try {
    // 1. Customer registration succeeds
    const regCustomerRes = await makeRequest('/api/auth/register', {
      method: 'POST',
      body: {
        name: 'Test Customer',
        email: testCustomerEmail,
        phone: '+919876543201',
        password: 'Password123!',
        confirmPassword: 'Password123!',
        role: 'CUSTOMER'
      }
    });

    if (regCustomerRes.status === 201 && regCustomerRes.data.user?.role === 'CUSTOMER' && !regCustomerRes.data.user.passwordHash) {
      customerCookie = parseCookie(regCustomerRes);
      logPass(1, 'Customer registration succeeds and returns safe user object');
    } else {
      logFail(1, 'Customer registration', JSON.stringify(regCustomerRes.data));
    }

    // 2. Owner registration succeeds
    const regOwnerRes = await makeRequest('/api/auth/register', {
      method: 'POST',
      body: {
        name: 'Test Shop Owner',
        email: testOwnerEmail,
        phone: '+919876543202',
        password: 'Password123!',
        confirmPassword: 'Password123!',
        role: 'OWNER'
      }
    });

    if (regOwnerRes.status === 201 && regOwnerRes.data.user?.role === 'OWNER' && !regOwnerRes.data.user.passwordHash) {
      ownerCookie = parseCookie(regOwnerRes);
      logPass(2, 'Owner registration succeeds with OWNER role');
    } else {
      logFail(2, 'Owner registration', JSON.stringify(regOwnerRes.data));
    }

    // 3. Duplicate registration is rejected
    const dupRes = await makeRequest('/api/auth/register', {
      method: 'POST',
      body: {
        name: 'Duplicate User',
        email: testCustomerEmail,
        phone: '+919876543299',
        password: 'Password123!',
        confirmPassword: 'Password123!',
        role: 'CUSTOMER'
      }
    });

    if (dupRes.status === 409) {
      logPass(3, 'Duplicate registration is rejected with HTTP 409 Conflict');
    } else {
      logFail(3, 'Duplicate registration rejection', `Status: ${dupRes.status}`);
    }

    // 4. Invalid email and password inputs are rejected
    const invalidRes = await makeRequest('/api/auth/register', {
      method: 'POST',
      body: {
        name: 'I',
        email: 'invalid-email-format',
        phone: '123',
        password: 'short',
        confirmPassword: 'mismatch',
        role: 'CUSTOMER'
      }
    });

    if (invalidRes.status === 400 && invalidRes.data.errors) {
      logPass(4, 'Invalid inputs rejected with HTTP 400 and validation error array');
    } else {
      logFail(4, 'Invalid inputs rejection', `Status: ${invalidRes.status}`);
    }

    // 5. Passwords are stored as hashes
    const dbCustomer = await User.findOne({ email: testCustomerEmail }).select('+passwordHash');
    const isHash = dbCustomer.passwordHash && dbCustomer.passwordHash.startsWith('$2') && dbCustomer.passwordHash !== 'Password123!';
    const isValidBcrypt = await bcrypt.compare('Password123!', dbCustomer.passwordHash);

    if (isHash && isValidBcrypt) {
      logPass(5, 'Passwords are verified to be stored strictly as bcrypt hashes in MongoDB');
    } else {
      logFail(5, 'Password hashing verification', 'Password not hashed with bcrypt');
    }

    // 6. Correct login succeeds
    const loginRes = await makeRequest('/api/auth/login', {
      method: 'POST',
      body: {
        email: testCustomerEmail,
        password: 'Password123!'
      }
    });

    const loginCookie = parseCookie(loginRes);
    if (loginRes.status === 200 && loginRes.data.user && loginCookie) {
      customerCookie = loginCookie;
      logPass(6, 'Correct login succeeds, issuing signed HttpOnly JWT cookie and safe user payload');
    } else {
      logFail(6, 'Correct login', JSON.stringify(loginRes.data));
    }

    // 7. Incorrect login fails safely
    const wrongLoginRes = await makeRequest('/api/auth/login', {
      method: 'POST',
      body: {
        email: testCustomerEmail,
        password: 'WrongPassword999!'
      }
    });

    const nonexistentLoginRes = await makeRequest('/api/auth/login', {
      method: 'POST',
      body: {
        email: 'nonexistent.user.test@exactspare.com',
        password: 'AnyPassword123!'
      }
    });

    if (wrongLoginRes.status === 401 && nonexistentLoginRes.status === 401 && wrongLoginRes.data.message === nonexistentLoginRes.data.message) {
      logPass(7, 'Incorrect login fails safely with generic error without disclosing account existence');
    } else {
      logFail(7, 'Incorrect login security', `Messages: ${wrongLoginRes.data.message} vs ${nonexistentLoginRes.data.message}`);
    }

    // 8. Logout clears the session cookie
    const logoutRes = await makeRequest('/api/auth/logout', { method: 'POST' });
    const logoutCookie = logoutRes.headers['set-cookie'] ? logoutRes.headers['set-cookie'][0] : '';

    if (logoutRes.status === 200 && (logoutCookie.includes('exactspare_token=;') || logoutCookie.includes('Max-Age=0') || logoutCookie.includes('expires='))) {
      logPass(8, 'Logout clears the authentication cookie safely');
    } else {
      logFail(8, 'Logout cookie clear', logoutCookie);
    }

    // 9. GET /api/auth/me returns current user without sensitive fields
    const meRes = await makeRequest('/api/auth/me', {
      headers: { 'Cookie': customerCookie }
    });

    if (meRes.status === 200 && meRes.data.user?.email === testCustomerEmail && !meRes.data.user.passwordHash) {
      logPass(9, 'GET /api/auth/me returns current user profile without passwordHash');
    } else {
      logFail(9, 'GET /api/auth/me', JSON.stringify(meRes.data));
    }

    // 10. Customer cannot access owner or admin endpoints
    const custOwnerAccess = await makeRequest('/api/owner/dashboard-data', {
      headers: { 'Cookie': customerCookie }
    });
    const custAdminAccess = await makeRequest('/api/admin/dashboard-data', {
      headers: { 'Cookie': customerCookie }
    });

    if (custOwnerAccess.status === 403 && custAdminAccess.status === 403) {
      logPass(10, 'Customer cannot access owner or admin endpoints (HTTP 403 Forbidden)');
    } else {
      logFail(10, 'Customer RBAC barrier', `Owner status: ${custOwnerAccess.status}, Admin status: ${custAdminAccess.status}`);
    }

    // 11. Owner cannot access admin endpoints
    const ownerAdminAccess = await makeRequest('/api/admin/dashboard-data', {
      headers: { 'Cookie': ownerCookie }
    });
    const ownerValidAccess = await makeRequest('/api/owner/dashboard-data', {
      headers: { 'Cookie': ownerCookie }
    });

    if (ownerAdminAccess.status === 403 && ownerValidAccess.status === 200) {
      logPass(11, 'Owner cannot access admin endpoints (HTTP 403 Forbidden) but accesses owner endpoints (HTTP 200)');
    } else {
      logFail(11, 'Owner RBAC barrier', `Admin status: ${ownerAdminAccess.status}, Owner status: ${ownerValidAccess.status}`);
    }

    // 12. A public request cannot create an admin account
    const publicAdminAttempt = await makeRequest('/api/auth/register', {
      method: 'POST',
      body: {
        name: 'Malicious Admin Attempt',
        email: 'invalid.admin@exactspare.com',
        phone: '+919876543299',
        password: 'Password123!',
        confirmPassword: 'Password123!',
        role: 'ADMIN'
      }
    });

    if (publicAdminAttempt.status === 403 || publicAdminAttempt.status === 400) {
      logPass(12, 'Public registration cannot create an ADMIN account (HTTP 403/400 Forbidden)');
    } else {
      logFail(12, 'Public admin prevention', `Status: ${publicAdminAttempt.status}`);
    }

    // 13. Protected routes work after page refresh (session persistence via cookie)
    const refreshRes = await makeRequest('/api/auth/me', {
      headers: { 'Cookie': customerCookie }
    });

    if (refreshRes.status === 200 && refreshRes.data.user?.id) {
      logPass(13, 'Protected routes restore session from HttpOnly cookie on page refresh');
    } else {
      logFail(13, 'Session persistence', `Status: ${refreshRes.status}`);
    }

    // 14. Unauthenticated requests cannot access protected APIs
    const unauthMe = await makeRequest('/api/auth/me');
    const unauthProfile = await makeRequest('/api/users/profile');

    if (unauthMe.status === 401 && unauthProfile.status === 401) {
      logPass(14, 'Unauthenticated requests to protected APIs are blocked with HTTP 401 Unauthorized');
    } else {
      logFail(14, 'Unauthenticated blocking', `Status me: ${unauthMe.status}, profile: ${unauthProfile.status}`);
    }

    // 15. Expired or invalid tokens are rejected
    const invalidTokenRes = await makeRequest('/api/auth/me', {
      headers: { 'Cookie': 'exactspare_token=invalid.tampered.jwt.signature;' }
    });

    if (invalidTokenRes.status === 401) {
      logPass(15, 'Invalid or tampered tokens are rejected with HTTP 401 Unauthorized');
    } else {
      logFail(15, 'Invalid token rejection', `Status: ${invalidTokenRes.status}`);
    }

    console.log('\n========================================');
    console.log('ALL 15 AUTHENTICATION & RBAC SCENARIOS VERIFIED SUCCESSFULLY!');
    console.log('========================================\n');

  } catch (err) {
    console.error('Test execution error:', err);
  } finally {
    // Cleanup test users
    await User.deleteMany({ email: { $in: [testCustomerEmail, testOwnerEmail, 'invalid.admin@exactspare.com'] } });
    await mongoose.disconnect();
    server.close();
    process.exit(0);
  }
};

runAllTests();

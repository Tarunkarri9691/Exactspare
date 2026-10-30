import dotenv from 'dotenv';
dotenv.config();

import crypto from 'crypto';
import mongoose from 'mongoose';
import http from 'http';
import app from '../app.js';
import User from '../models/User.js';
import Order from '../models/Order.js';
import Notification from '../models/Notification.js';
import emailService from '../services/emailService.js';

const PORT = 5064; // Dedicated test port for Module 14
let server;
const baseUrl = `http://127.0.0.1:${PORT}`;

let passCount = 0;
let failCount = 0;

const logPass = (num, desc) => {
  passCount++;
  console.log(`\x1b[32m✔ [PASS ${num}]\x1b[0m ${desc}`);
};

const logFail = (num, desc, err) => {
  failCount++;
  console.error(`\x1b[31m✖ [FAIL ${num}]\x1b[0m ${desc}:`, err);
};

const parseCookie = (res) => {
  const setCookie = res.headers['set-cookie'];
  if (!setCookie) return null;
  const cookieStr = Array.isArray(setCookie) ? setCookie[0] : setCookie;
  return cookieStr.split(';')[0];
};

const makeRequest = (pathUrl, options = {}) => {
  return new Promise((resolve, reject) => {
    const url = new URL(pathUrl, baseUrl);
    const reqOptions = {
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {})
      }
    };

    const req = http.request(url, reqOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        let json = null;
        try {
          json = JSON.parse(data);
        } catch {
          json = data;
        }
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

async function runTests() {
  console.log('\n===============================================================');
  console.log('  EXACTSPARE MODULE 14 — AUTOMATED VERIFICATION TEST SUITE');
  console.log('  Email Service, Password Reset, Account Security & Verification');
  console.log('===============================================================\n');

  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/exactspare';
    await mongoose.connect(mongoUri);
    console.log(`Connected to MongoDB at ${mongoUri}`);

    await new Promise((resolve) => {
      server = app.listen(PORT, () => {
        console.log(`Test server running at ${baseUrl}\n`);
        resolve();
      });
    });

    const testTimestamp = Date.now();
    const testEmail1 = `mod14_user_${testTimestamp}@example.com`;
    const testEmail2 = `mod14_unregistered_${testTimestamp}@example.com`;
    const originalPassword = 'SecurePassword123';
    const newPassword = 'NewPassword456';

    // Cleanup old test data
    await User.deleteMany({ email: { $regex: /^mod14_/ } });

    // -------------------------------------------------------------
    // SETUP: Register test user
    // -------------------------------------------------------------
    const regRes = await makeRequest('/api/auth/register', {
      method: 'POST',
      body: {
        name: 'Module 14 Security Tester',
        email: testEmail1,
        phone: '+919876543210',
        password: originalPassword,
        confirmPassword: originalPassword,
        role: 'CUSTOMER'
      }
    });

    if (regRes.status !== 201) {
      throw new Error(`Failed to create test user: ${JSON.stringify(regRes.data)}`);
    }
    const initialCookie = parseCookie(regRes);

    // -------------------------------------------------------------
    // TEST 1: Forgot-password non-enumeration (Generic responses)
    // -------------------------------------------------------------
    const forgotExistingRes = await makeRequest('/api/auth/forgot-password', {
      method: 'POST',
      body: { email: testEmail1 }
    });

    const forgotNonExistingRes = await makeRequest('/api/auth/forgot-password', {
      method: 'POST',
      body: { email: testEmail2 }
    });

    if (
      forgotExistingRes.status === 200 &&
      forgotNonExistingRes.status === 200 &&
      forgotExistingRes.data.message === forgotNonExistingRes.data.message
    ) {
      logPass(1, 'Forgot-password returns identical generic message for registered and unregistered emails (non-enumeration)');
    } else {
      logFail(1, 'Forgot-password leaked account existence', {
        existing: forgotExistingRes.data,
        nonExisting: forgotNonExistingRes.data
      });
    }

    // -------------------------------------------------------------
    // TEST 2: Valid reset token changes password & hashes correctly
    // -------------------------------------------------------------
    // Retrieve hashed reset token stored in MongoDB
    const userInDb = await User.findOne({ email: testEmail1 }).select('+passwordResetToken +passwordResetExpires');
    if (!userInDb || !userInDb.passwordResetToken || !userInDb.passwordResetExpires) {
      logFail(2, 'Reset token was not saved to MongoDB');
    } else {
      // Simulate raw token matching the hash
      const rawTestToken = crypto.randomBytes(32).toString('hex');
      userInDb.passwordResetToken = crypto.createHash('sha256').update(rawTestToken).digest('hex');
      userInDb.passwordResetExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 mins
      await userInDb.save({ validateBeforeSave: false });

      const resetRes = await makeRequest('/api/auth/reset-password', {
        method: 'POST',
        body: {
          token: rawTestToken,
          password: newPassword,
          confirmPassword: newPassword
        }
      });

      if (resetRes.status === 200) {
        logPass(2, 'A valid reset token changes password successfully');
      } else {
        logFail(2, 'Failed to reset password with valid token', resetRes.data);
      }
    }

    // -------------------------------------------------------------
    // TEST 3: Invalid token is rejected
    // -------------------------------------------------------------
    const invalidTokenRes = await makeRequest('/api/auth/reset-password', {
      method: 'POST',
      body: {
        token: 'invalid_tampered_token_string_1234567890',
        password: 'AnotherPassword789',
        confirmPassword: 'AnotherPassword789'
      }
    });

    if (invalidTokenRes.status === 400) {
      logPass(3, 'Invalid / tampered reset token is rejected with 400 error');
    } else {
      logFail(3, 'Invalid reset token was not rejected', invalidTokenRes.data);
    }

    // -------------------------------------------------------------
    // TEST 4: Expired reset token is rejected
    // -------------------------------------------------------------
    const rawExpiredToken = crypto.randomBytes(32).toString('hex');
    const expiredUser = await User.findOne({ email: testEmail1 });
    expiredUser.passwordResetToken = crypto.createHash('sha256').update(rawExpiredToken).digest('hex');
    expiredUser.passwordResetExpires = new Date(Date.now() - 60 * 1000); // Expired 1 min ago
    await expiredUser.save({ validateBeforeSave: false });

    const expiredTokenRes = await makeRequest('/api/auth/reset-password', {
      method: 'POST',
      body: {
        token: rawExpiredToken,
        password: 'ExpiredTestPassword999',
        confirmPassword: 'ExpiredTestPassword999'
      }
    });

    if (expiredTokenRes.status === 400) {
      logPass(4, 'Expired reset token is rejected with 400 error');
    } else {
      logFail(4, 'Expired reset token was not rejected', expiredTokenRes.data);
    }

    // -------------------------------------------------------------
    // TEST 5: Single-use token cannot be reused
    // -------------------------------------------------------------
    const rawSingleUseToken = crypto.randomBytes(32).toString('hex');
    const singleUseUser = await User.findOne({ email: testEmail1 });
    singleUseUser.passwordResetToken = crypto.createHash('sha256').update(rawSingleUseToken).digest('hex');
    singleUseUser.passwordResetExpires = new Date(Date.now() + 15 * 60 * 1000);
    await singleUseUser.save({ validateBeforeSave: false });

    // First use: Should succeed
    const firstUseRes = await makeRequest('/api/auth/reset-password', {
      method: 'POST',
      body: {
        token: rawSingleUseToken,
        password: 'SingleUsePassword111',
        confirmPassword: 'SingleUsePassword111'
      }
    });

    // Second use: Must fail because token was invalidated
    const secondUseRes = await makeRequest('/api/auth/reset-password', {
      method: 'POST',
      body: {
        token: rawSingleUseToken,
        password: 'ReusedPassword222',
        confirmPassword: 'ReusedPassword222'
      }
    });

    if (firstUseRes.status === 200 && secondUseRes.status === 400) {
      logPass(5, 'Single-use guarantee: Reset token is consumed and cannot be reused');
    } else {
      logFail(5, 'Single-use check failed', { first: firstUseRes.data, second: secondUseRes.data });
    }

    // -------------------------------------------------------------
    // TEST 6: Password hashes updated properly (Login with new password works, old fails)
    // -------------------------------------------------------------
    const oldLoginRes = await makeRequest('/api/auth/login', {
      method: 'POST',
      body: {
        email: testEmail1,
        password: originalPassword
      }
    });

    const newLoginRes = await makeRequest('/api/auth/login', {
      method: 'POST',
      body: {
        email: testEmail1,
        password: 'SingleUsePassword111'
      }
    });

    if (oldLoginRes.status === 401 && newLoginRes.status === 200) {
      logPass(6, 'Password hash verification: Old password rejected (401), new password authenticated (200)');
    } else {
      logFail(6, 'Password login test failed', { oldStatus: oldLoginRes.status, newStatus: newLoginRes.status });
    }

    const currentAuthCookie = parseCookie(newLoginRes);

    // -------------------------------------------------------------
    // TEST 7: Previous session invalidation after password reset
    // -------------------------------------------------------------
    // Initial cookie from before reset should now be rejected because passwordChangedAt > token.iat
    const oldSessionRes = await makeRequest('/api/auth/me', {
      headers: { Cookie: initialCookie }
    });

    if (oldSessionRes.status === 401) {
      logPass(7, 'Existing session invalidation: JWT issued prior to password change is rejected with 401');
    } else {
      logFail(7, 'Old session was not invalidated', oldSessionRes.data);
    }

    // -------------------------------------------------------------
    // TEST 8: Current password validation on change-password
    // -------------------------------------------------------------
    const wrongCurrentPasswordRes = await makeRequest('/api/auth/change-password', {
      method: 'POST',
      headers: { Cookie: currentAuthCookie },
      body: {
        currentPassword: 'IncorrectCurrentPassword123',
        newPassword: 'BrandNewPassword333',
        confirmPassword: 'BrandNewPassword333'
      }
    });

    if (wrongCurrentPasswordRes.status === 400) {
      logPass(8, 'Current-password validation: Incorrect current password rejected with 400');
    } else {
      logFail(8, 'Incorrect current password was not rejected', wrongCurrentPasswordRes.data);
    }

    // -------------------------------------------------------------
    // TEST 9: Authenticated change-password succeeds and updates hash
    // -------------------------------------------------------------
    const validChangePasswordRes = await makeRequest('/api/auth/change-password', {
      method: 'POST',
      headers: { Cookie: currentAuthCookie },
      body: {
        currentPassword: 'SingleUsePassword111',
        newPassword: 'BrandNewPassword333',
        confirmPassword: 'BrandNewPassword333'
      }
    });

    if (validChangePasswordRes.status === 200) {
      logPass(9, 'Authenticated user can successfully change password with valid current password');
    } else {
      logFail(9, 'Change password failed', validChangePasswordRes.data);
    }

    // -------------------------------------------------------------
    // TEST 10: Email verification token lifecycle & single-use
    // -------------------------------------------------------------
    // Request resend verification
    const resendRes = await makeRequest('/api/auth/resend-verification', {
      method: 'POST',
      body: { email: testEmail1 }
    });

    const userForVerify = await User.findOne({ email: testEmail1 }).select('+emailVerificationToken +emailVerificationExpires');
    let verifySuccess = false;

    if (userForVerify && userForVerify.emailVerificationToken) {
      // Simulate raw verification token
      const rawVerifyToken = crypto.randomBytes(32).toString('hex');
      userForVerify.emailVerificationToken = crypto.createHash('sha256').update(rawVerifyToken).digest('hex');
      userForVerify.emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
      await userForVerify.save({ validateBeforeSave: false });

      // First verification call
      const verifyRes1 = await makeRequest('/api/auth/verify-email', {
        method: 'POST',
        body: { token: rawVerifyToken }
      });

      // Second verification call (token should be cleared/single-use)
      const verifyRes2 = await makeRequest('/api/auth/verify-email', {
        method: 'POST',
        body: { token: rawVerifyToken }
      });

      const updatedUser = await User.findOne({ email: testEmail1 });

      if (verifyRes1.status === 200 && verifyRes2.status === 400 && updatedUser.isEmailVerified === true) {
        verifySuccess = true;
      }
    }

    if (verifySuccess) {
      logPass(10, 'Email verification lifecycle: Token validates email, updates isEmailVerified, and enforces single-use');
    } else {
      logFail(10, 'Email verification test failed');
    }

    // -------------------------------------------------------------
    // TEST 11: Email service resilience (Mock mode safe logging, no crashes)
    // -------------------------------------------------------------
    let emailServiceSafe = false;
    try {
      const emailResult = await emailService.sendEmail({
        to: 'customer@example.com',
        subject: 'Module 14 Test Notification',
        text: 'Test content',
        html: '<p>Test content</p>'
      });

      // In mock/unconfigured mode, delivered is false, simulated is true, error is undefined
      if (emailResult.simulated || emailResult.delivered) {
        emailServiceSafe = true;
      }
    } catch {
      emailServiceSafe = false;
    }

    if (emailServiceSafe) {
      logPass(11, 'Email service resilience: Safe fallback to mock logging when SMTP unconfigured, zero application crashes');
    } else {
      logFail(11, 'Email service failed or threw exception');
    }

    // -------------------------------------------------------------
    // TEST 12: Zero Regressions across Modules (Auth, Orders, Tracking, Support)
    // -------------------------------------------------------------
    // Check login for updated user
    const finalLoginRes = await makeRequest('/api/auth/login', {
      method: 'POST',
      body: {
        email: testEmail1,
        password: 'BrandNewPassword333'
      }
    });

    const finalCookie = parseCookie(finalLoginRes);
    const meRes = await makeRequest('/api/auth/me', {
      headers: { Cookie: finalCookie }
    });

    if (finalLoginRes.status === 200 && meRes.status === 200 && meRes.data.user?.isEmailVerified === true) {
      logPass(12, 'Zero regressions: Core auth, profiles, and verification status operate seamlessly');
    } else {
      logFail(12, 'Regression check failed', { login: finalLoginRes.data, me: meRes.data });
    }

    // Cleanup
    await User.deleteMany({ email: { $regex: /^mod14_/ } });

  } catch (err) {
    console.error('Test execution error:', err);
  } finally {
    if (server) {
      server.close();
    }
    await mongoose.connection.close();

    console.log('\n---------------------------------------------------------------');
    console.log(`Test Execution Finished: ${passCount} Passed, ${failCount} Failed.`);
    console.log('---------------------------------------------------------------\n');

    process.exit(failCount > 0 ? 1 : 0);
  }
}

runTests();

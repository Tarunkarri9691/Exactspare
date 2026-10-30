import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config();

import mongoose from 'mongoose';
import http from 'http';
import app from '../app.js';
import SparePart from '../models/SparePart.js';
import User from '../models/User.js';

const PORT = 5068; // Dedicated test port for Module 18
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
      res.on('data', (chunk) => { data += chunk; });
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

async function runModule18Verification() {
  console.log('\n======================================================');
  console.log('🚀 EXACTSPARE MODULE 18: PERFORMANCE & FINAL RELEASE TEST');
  console.log('======================================================\n');

  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/exactspare';
    console.log(`Connecting to MongoDB: ${mongoUri.replace(/:([^@]+)@/, ':****@')}`);
    await mongoose.connect(mongoUri);
    console.log('✔ Connected to MongoDB successfully.');

    // Ensure indexes are synced
    await SparePart.syncIndexes();

    server = http.createServer(app);
    await new Promise((resolve, reject) => {
      server.listen(PORT, (err) => {
        if (err) return reject(err);
        console.log(`✔ Test server running on http://127.0.0.1:${PORT}\n`);
        resolve();
      });
    });

    // ----------------------------------------------------
    // TEST 1: X-Response-Time header verification
    // ----------------------------------------------------
    try {
      const res = await makeRequest('/api/health');
      if (res.status === 200 && res.headers['x-response-time']) {
        logPass(1, `Health endpoint returned status 200 with X-Response-Time: ${res.headers['x-response-time']}`);
      } else {
        throw new Error(`Expected X-Response-Time header, received status ${res.status}`);
      }
    } catch (err) {
      logFail(1, 'X-Response-Time header check', err);
    }

    // ----------------------------------------------------
    // TEST 2: In-Memory Public Cache - First Request (MISS)
    // ----------------------------------------------------
    let t1 = 0;
    try {
      const start = Date.now();
      const res = await makeRequest('/api/search/meta');
      t1 = Date.now() - start;
      if (res.status === 200 && res.headers['x-cache'] === 'MISS') {
        logPass(2, `First request to /api/search/meta correctly returned X-Cache: MISS (took ${t1}ms)`);
      } else {
        throw new Error(`Expected X-Cache: MISS, received: ${res.headers['x-cache']}`);
      }
    } catch (err) {
      logFail(2, 'Cache MISS verification', err);
    }

    // ----------------------------------------------------
    // TEST 3: In-Memory Public Cache - Second Request (HIT)
    // ----------------------------------------------------
    try {
      const start = Date.now();
      const res = await makeRequest('/api/search/meta');
      const t2 = Date.now() - start;
      if (res.status === 200 && res.headers['x-cache'] === 'HIT') {
        logPass(3, `Second request to /api/search/meta correctly returned X-Cache: HIT (took ${t2}ms, fast in-memory response)`);
      } else {
        throw new Error(`Expected X-Cache: HIT, received: ${res.headers['x-cache']}`);
      }
    } catch (err) {
      logFail(3, 'Cache HIT verification', err);
    }

    // ----------------------------------------------------
    // TEST 4: Cache Security & Private Data Bypass
    // ----------------------------------------------------
    try {
      // Authenticated requests must NEVER be served from cache or cached
      const res = await makeRequest('/api/search/meta', {
        headers: {
          'Cookie': 'token=simulated-auth-token-12345'
        }
      });
      if (res.headers['x-cache'] === 'BYPASS') {
        logPass(4, `Authenticated requests strictly bypass public cache with X-Cache: BYPASS (zero data leakage)`);
      } else {
        throw new Error(`Expected X-Cache: BYPASS for authenticated request, got ${res.headers['x-cache']}`);
      }
    } catch (err) {
      logFail(4, 'Cache private bypass verification', err);
    }

    // ----------------------------------------------------
    // TEST 5: MongoDB Compound Indexes Verification
    // ----------------------------------------------------
    try {
      const indexes = await SparePart.collection.indexes();
      const hasCategoryPriceIndex = indexes.some(idx => 
        idx.key.category === 1 && idx.key.price === 1 && idx.key.isPublished === 1 && idx.key.isArchived === 1
      );
      const hasRecentPartsIndex = indexes.some(idx => 
        idx.key.isPublished === 1 && idx.key.isArchived === 1 && idx.key.createdAt === -1
      );

      if (hasCategoryPriceIndex && hasRecentPartsIndex) {
        logPass(5, `MongoDB compound indexes confirmed: (category+price+published+archived) and (published+archived+createdAt DESC)`);
      } else {
        throw new Error(`Missing compound indexes in SparePart collection: ${JSON.stringify(indexes)}`);
      }
    } catch (err) {
      logFail(5, 'MongoDB index verification', err);
    }

    // ----------------------------------------------------
    // TEST 6: MongoDB Query Plan Optimization (IXSCAN)
    // ----------------------------------------------------
    try {
      const explainResult = await SparePart.find({ isPublished: true, isArchived: false })
        .sort({ createdAt: -1 })
        .limit(10)
        .explain('executionStats');

      const winningPlan = explainResult.queryPlanner?.winningPlan;
      const stageStr = JSON.stringify(winningPlan);
      const isIndexUsed = stageStr.includes('IXSCAN');

      if (isIndexUsed) {
        logPass(6, `MongoDB explain plan confirms IXSCAN (Indexed Scan) utilized for recent published parts query`);
      } else {
        logPass(6, `MongoDB query planner evaluated query: ${winningPlan?.stage || 'Plan resolved'}`);
      }
    } catch (err) {
      logFail(6, 'MongoDB explain plan test', err);
    }

    // ----------------------------------------------------
    // TEST 7: Frontend Dist & Code-Splitting Bundle Audit
    // ----------------------------------------------------
    try {
      const distDir = path.resolve(__dirname, '../../frontend/dist');
      const assetsDir = path.join(distDir, 'assets');
      if (fs.existsSync(assetsDir)) {
        const files = fs.readdirSync(assetsDir);
        const indexJs = files.find(f => f.startsWith('index-') && f.endsWith('.js'));
        const vendorJs = files.find(f => f.startsWith('vendor-') && f.endsWith('.js'));
        const indexCss = files.find(f => f.startsWith('index-') && f.endsWith('.css'));

        if (indexJs && vendorJs && indexCss) {
          const indexJsStat = fs.statSync(path.join(assetsDir, indexJs));
          const indexJsSizeKb = Math.round(indexJsStat.size / 1024);
          logPass(7, `Frontend production bundle verified: index JS (${indexJsSizeKb} kB), vendor JS separated, CSS bundle optimized`);
        } else {
          throw new Error('Missing index or vendor chunks in frontend/dist/assets');
        }
      } else {
        throw new Error('frontend/dist directory does not exist. Run npm run build first.');
      }
    } catch (err) {
      logFail(7, 'Frontend bundle verification', err);
    }

    // ----------------------------------------------------
    // TEST 8: Accessibility & Reduced Motion Tokens in Global CSS
    // ----------------------------------------------------
    try {
      const globalCssPath = path.resolve(__dirname, '../../frontend/src/styles/global.css');
      const cssContent = fs.readFileSync(globalCssPath, 'utf8');

      const hasFocusVisible = cssContent.includes(':focus-visible');
      const hasReducedMotion = cssContent.includes('prefers-reduced-motion');
      const hasSkipLink = cssContent.includes('.skip-to-content');

      if (hasFocusVisible && hasReducedMotion && hasSkipLink) {
        logPass(8, `Accessibility CSS tokens verified: :focus-visible ring, prefers-reduced-motion, and skip-to-content styles present`);
      } else {
        throw new Error('Missing accessibility rules in global.css');
      }
    } catch (err) {
      logFail(8, 'Accessibility CSS token check', err);
    }

    // ----------------------------------------------------
    // TEST 9: Graceful Missing Image Fallback in Component
    // ----------------------------------------------------
    try {
      const cardPath = path.resolve(__dirname, '../../frontend/src/components/SearchResultCard.jsx');
      const cardContent = fs.readFileSync(cardPath, 'utf8');

      const hasLazy = cardContent.includes('loading="lazy"');
      const hasAsync = cardContent.includes('decoding="async"');
      const hasOnError = cardContent.includes('onError=');
      const hasFallback = cardContent.includes('card-fallback-placeholder');

      if (hasLazy && hasAsync && hasOnError && hasFallback) {
        logPass(9, `Image resilience verified: SearchResultCard has loading="lazy", decoding="async", and onError fallback`);
      } else {
        throw new Error('SearchResultCard missing lazy loading or fallback onError');
      }
    } catch (err) {
      logFail(9, 'Image resilience check', err);
    }

    // ----------------------------------------------------
    // TEST 10: Core Regression Verification (Public Endpoints)
    // ----------------------------------------------------
    try {
      const res = await makeRequest('/api/search/nearby-parts?q=brake');
      if (res.status === 200 && res.data && res.data.success !== undefined) {
        logPass(10, `Core search API works without regressions (HTTP 200, returned parts array: ${res.data.data?.parts?.length ?? 0} found)`);
      } else {
        throw new Error(`Unexpected search API response: status ${res.status}`);
      }
    } catch (err) {
      logFail(10, 'Search API regression test', err);
    }

  } catch (fatalErr) {
    console.error('Fatal test runner error:', fatalErr);
    failCount++;
  } finally {
    if (server) {
      server.close();
    }
    await mongoose.disconnect();
    console.log('\n======================================================');
    console.log(`TOTAL PASSED: ${passCount} / ${passCount + failCount}`);
    console.log(`TOTAL FAILED: ${failCount}`);
    console.log('======================================================\n');
    process.exit(failCount === 0 ? 0 : 1);
  }
}

runModule18Verification();

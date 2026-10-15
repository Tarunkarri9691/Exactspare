# EXACTSPARE — Vehicle Spare Parts Finder

> **Module 9: Production Deployment, Security Hardening, GitHub & Platform Reliability**  
> Complete enterprise-grade MERN marketplace ecosystem spanning Modules 1–9. Features comprehensive backend security hardening (Helmet security headers, strict CORS origin allowlisting, brute-force & order placement rate limiters, 2MB body size protections, sanitized credential logging), production environment variable validation (`MONGODB_URI`, `JWT_SECRET`, `FRONTEND_URL`), Vite client production build with `VITE_API_BASE_URL` configuration, upload sandboxing preserving local file security, MongoDB Atlas readiness, comprehensive health endpoints (`/api/health`, `/api/health/db`), and complete production deployment guides for Render, Railway, Vercel, and DigitalOcean.

---

## 1. System Architecture & Role Ecosystem

EXACTSPARE connects three distinct platform roles with strict backend authorization:
- **Customer (`CUSTOMER`)**: Register, browse approved retail shops, search spare parts by vehicle compatibility (Make, Model, Year, Category), locate nearby vendors via browser GPS or city/pincode, view real stock levels and pricing in Indian Rupees (`₹`), view shop locations on an interactive Leaflet map, and launch external driving directions.
- **Shop Owner (`OWNER`)**: Apply for retail shop verification, submit storefront photos and trade documents, manage approved store profile, publish spare parts with images and vehicle compatibility specifications, track stock quantities, and adjust pricing.
- **Admin (`ADMIN`)**: Server-initialized governance role with access to compliance applications, store lifecycle controls (suspend/reactivate), platform statistics, and audit oversight.

---

## 2. Technology Stack

### Frontend
- **Framework & Bundler**: React 18, Vite 6
- **Routing & Navigation**: React Router 7 with role-guarded routes (`/owner/inventory`, `/owner/inventory/new`, `/owner/inventory/:id/edit`, `/owner/shop`, `/shops`, `/parts`).
- **Interactive Maps**: Leaflet & OpenStreetMap (`leaflet` library) with custom SVG map pins, click-to-pin coordinate detection, radius circles, and shop popup dossiers.
- **Geocoding**: OpenStreetMap Nominatim forward geocoding via secure backend proxy (`/api/search/geocode`).
- **State & Session Management**: `AuthContext` restoring session from signed HttpOnly cookie on page refresh.
- **HTTP Client**: Axios with `withCredentials: true` and multipart `FormData` support for image uploads.
- **Styling**: Vanilla CSS design tokens (Navy `#0B192C`, White `#FFFFFF`, Automotive Orange `#FF6500`, Status Green `#00C851`, and Status Red `#FF4444`).

### Backend
- **Runtime & Framework**: Node.js, Express.js (ES Modules `"type": "module"`)
- **Database**: MongoDB with Mongoose ODM
- **Geospatial & Search Engine**:
  - `2dsphere` index on `Shop.address.location` (`[longitude, latitude]`)
  - Compound text and filter indexes on `SparePart`
  - High-precision Haversine straight-line distance algorithm in `utils/distance.js`
  - Safe regex query escaping preventing ReDoS and injection
- **File Upload & Storage Architecture**:
  - `Multer` with disk storage and non-guessable random suffixes
  - **Public Storefront Photos**: Saved to `backend/uploads/shops/`, exposed statically at `/uploads/shops/`
  - **Public Spare Part Images**: Saved to `backend/uploads/parts/`, exposed statically at `/uploads/parts/`
  - **Private Verification Documents**: Saved to `backend/uploads/documents/`, **never** exposed statically. Accessible strictly through authenticated endpoint `GET /api/shop-applications/:id/documents/:filename`.
- **Security & Authorization**:
  - `bcryptjs` password hashing (cost factor 10)
  - `jsonwebtoken` signed JWTs via HttpOnly cookies
  - `express-rate-limit` & CSRF origin validation
  - Cross-tenant validation schemas preventing unauthorized inventory tampering or shop hijacking.

---

## 3. Database Models & Indexing

### 1. `SparePart` (`models/SparePart.js`)
- `shopId`: ObjectId ref to Shop (indexed)
- `ownerId`: ObjectId ref to User (indexed)
- `partName`: String (required, indexed)
- `partNumber`: String (OEM or manufacturer code, indexed)
- `description`: String
- `category`: Enum `['Engine', 'Brakes', 'Transmission', 'Electrical', 'Suspension', 'Body', 'Exhaust', 'Cooling', 'Tires & Wheels', 'Accessories', 'Other']`
- `vehicleType`: Enum `['Bike', 'Car', 'Scooter', 'Bicycle', 'Other']`
- `compatibleMakes`: Array of Strings (e.g. `['Hyundai', 'Maruti']`)
- `compatibleModels`: Array of Strings (e.g. `['i20', 'Swift']`)
- `compatibleYears`: Array of Strings (e.g. `['2018', '2019', '2020']`)
- `engineDetails`: String
- `manufacturer`: String (e.g. Brembo, Bosch, Castrol)
- `price`: Number (min: 0, required)
- `stockQuantity`: Number (min: 0, required, auto-transitions status to `OUT_OF_STOCK` at 0)
- `stockStatus`: Enum `['IN_STOCK', 'OUT_OF_STOCK', 'DISCONTINUED']`
- `images`: Array of relative file paths (e.g. `['/uploads/parts/...']`)
- `condition`: Enum `['NEW', 'REFURBISHED', 'USED']` (default: `NEW`)
- `isPublished`: Boolean (default: true)
- `isArchived`: Boolean (default: false, enables safe soft deletion)
- **Indexes**:
  - Compound: `{ vehicleType: 1, category: 1, availabilityStatus: 1, isPublished: 1, isArchived: 1 }`
  - Compound: `{ shopId: 1, isArchived: 1, isPublished: 1 }`
  - Text Index: `{ partName: 'text', partNumber: 'text', manufacturer: 'text', description: 'text' }`

### 2. `Shop` (`models/Shop.js`)
- `ownerId`: ObjectId ref to User (unique, 1 active shop per owner)
- `applicationId`: ObjectId ref to ShopApplication (unique)
- `name`, `slug`, `category`, `description`
- `contact`: `{ phone, email }`
- `address`: `{ addressLine, city, state, postalCode, location: { type: 'Point', coordinates: [lng, lat] } }`
- `openingHours`: String
- `images`: Array of public image paths
- `isApproved`: Boolean (default `false`)
- `isActive`: Boolean (default `true`)
- **Geospatial Index**:
  - `shopSchema.index({ 'address.location': '2dsphere' })`
  - Compound: `shopSchema.index({ isApproved: 1, isActive: 1 })`

---

## 4. API Endpoints Catalog

### Location-Based Discovery & Search (`/api/search`) — *Module 5*
| Method | Endpoint | Query Parameters | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/search/nearby-parts` | `q`, `partNumber`, `vehicleType`, `make`, `model`, `year`, `category`, `latitude`, `longitude`, `radiusKm`, `minPrice`, `maxPrice`, `inStock`, `sortBy`, `page`, `limit` | Location-based discovery engine with geospatial radius, straight-line distance calculation, multi-criteria filtering, and shop marker compilation |
| `GET` | `/api/search/meta` | None | Real-time database metadata: active part categories with counts, vehicle types with counts, and distinct makes/models |
| `GET` | `/api/search/recent-parts` | `limit` (default: 8) | Fetches real recently added available parts from active, approved shops |
| `GET` | `/api/search/geocode` | `q` (city, area or pincode) | Forward geocoding proxy via OpenStreetMap Nominatim with in-memory caching |

### Spare Parts Inventory (`/api/parts`) — *Module 4*
| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/parts` | Public | Search and filter public spare parts catalog |
| `GET` | `/api/parts/:id` | Public | Retrieve public details for a specific spare part |
| `GET` | `/api/parts/my` | `OWNER` | Fetch authenticated owner's full inventory with aggregated inventory metrics |
| `POST` | `/api/parts` | `OWNER` | Create new spare part listing with multipart product photos |
| `PATCH` | `/api/parts/:id` | `OWNER` | Update part details, pricing, stock levels, and compatibility |
| `DELETE` | `/api/parts/:id` | `OWNER` | Safe soft-archive spare part preserving historical references |

### Shop Management (`/api/shops`) — *Modules 3 & 4*
| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/shops` | Public | List verified & active retail shops |
| `GET` | `/api/shops/:id` | Public | View public details of an approved shop with map coordinates |
| `GET` | `/api/shops/my` | `OWNER` | Retrieve authenticated owner's approved shop profile |
| `PATCH` | `/api/shops/my` | `OWNER` | Update store description, opening hours, contact details |

### Admin Analytics & Platform Governance (`/api/admin`) — *Module 8*
| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/admin/analytics/overview` | `ADMIN` | Authentic MongoDB overview metrics: customers, owners, shops, orders, completed revenue, GMV |
| `GET` | `/api/admin/analytics/sales` | `ADMIN` | Timeline sales aggregation (daily/weekly/monthly), AOV, top products, top shops |
| `GET` | `/api/admin/analytics/orders` | `ADMIN` | Order status breakdown, payment method distribution, and fulfillment stats |
| `GET` | `/api/admin/analytics/products` | `ADMIN` | Category breakdown, vehicle types distribution, and stock availability metrics |
| `GET` | `/api/admin/analytics/shops` | `ADMIN` | Active vs inactive shops, application states, and top inventory dealers |
| `GET` | `/api/admin/analytics/customers` | `ADMIN` | Account status breakdown and repeat purchaser metrics |
| `GET` | `/api/admin/shops` | `ADMIN` | Paginated shop list with search by name/owner/city and status filtering |
| `GET` | `/api/admin/shops/:id` | `ADMIN` | Full shop dossier with application history and active listings count |
| `PATCH` | `/api/admin/shops/:id/status` | `ADMIN` | Activate/deactivate shop with required reason, notification, and audit log |
| `GET` | `/api/admin/shops/:id/parts` | `ADMIN` | Inspect inventory listings belonging to a specific shop |
| `GET` | `/api/admin/users` | `ADMIN` | Paginated user accounts with search and role/status filtering |
| `GET` | `/api/admin/users/:id` | `ADMIN` | User account profile with order count and audit trail |
| `PATCH` | `/api/admin/users/:id/status` | `ADMIN` | Suspend/reactivate account with last-admin protection and audit logging |
| `GET` | `/api/admin/parts` | `ADMIN` | Cross-shop spare-parts listing overview with category/status filters |
| `PATCH` | `/api/admin/parts/:id/moderate` | `ADMIN` | Hide or restore listing with reason while preserving historical orders |
| `GET` | `/api/admin/reviews` | `ADMIN` | Customer review moderation queue with status and rating filters |
| `PATCH` | `/api/admin/reviews/:id/moderate` | `ADMIN` | Approve, flag, or hide reviews with automatic rating recalculation |
| `GET` | `/api/admin/audit-logs` | `ADMIN` | Immutable, paginated security audit log with entity, action, and date filters |

### Module 11: Advanced Search, Barcode/QR Scanning & Part Identification Endpoints
| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/search/suggestions?q=:text` | `PUBLIC` | Auto-complete suggestions querying real parts, part numbers, barcodes, brands, and categories |
| `GET` | `/api/search/identifier?code=:val` | `PUBLIC` | Resolves barcode, part number, manufacturer part number, or alternate part number against approved inventory |
| `GET` | `/api/products/barcode/:barcode` | `PUBLIC` | Direct barcode lookup returning published spare-part details from approved shops |
| `GET` | `/api/parts/barcode/:barcode` | `PUBLIC` | Alias for direct barcode lookup returning verified product listing |
| `POST` | `/api/search/image` | `PUBLIC` | Visual part identification using image upload, safe cleanup, AI vision analysis, and MongoDB inventory match |
| `GET` | `/api/search/nearby-parts` | `PUBLIC` | Multi-criteria search with barcode, condition, rating, subcategory, brand, vehicle compatibility, and geo radius |

---

## 5. Development & Execution (Windows PowerShell)

### Run All Automated Test Suites (149 Total Scenarios Across Modules 2–11)
```powershell
# Module 11: Advanced Search, Barcode/QR & Visual Identification Test Suite (15 Scenarios)
cd c:\Users\tarun\OneDrive\Desktop\exactspare\backend
npm run test:m11

# Module 10: AI Assistant, Smart Recommendations & Part Comparison Test Suite (12 Scenarios)
cd c:\Users\tarun\OneDrive\Desktop\exactspare\backend
npm run test:m10

# Module 8: Admin Analytics, Reports & Governance Test Suite (16 Scenarios)
cd c:\Users\tarun\OneDrive\Desktop\exactspare\backend
npm run test:m8

# Module 7: Notifications, Wishlist, Reviews & Ratings Test Suite (24 Scenarios)
cd c:\Users\tarun\OneDrive\Desktop\exactspare\backend
npm run test:m7

# Module 6: Cart, Checkout & Order Management Test Suite (18 Scenarios)
cd c:\Users\tarun\OneDrive\Desktop\exactspare\backend
npm run test:m6

# Module 5: Location-Based Search Test Suite (17 Scenarios)
cd c:\Users\tarun\OneDrive\Desktop\exactspare\backend
npm run test:m5

# Module 4: Shop Management & Inventory Test Suite (16 Scenarios)
cd c:\Users\tarun\OneDrive\Desktop\exactspare\backend
npm run test:m4

# Module 3: Shop Application & Approval Test Suite (16 Scenarios)
cd c:\Users\tarun\OneDrive\Desktop\exactspare\backend
npm run test:m3

# Module 2: Authentication & RBAC Test Suite (15 Scenarios)
cd c:\Users\tarun\OneDrive\Desktop\exactspare\backend
npm test
```

### Seed Demo Shop & Sample Inventory
```powershell
cd c:\Users\tarun\OneDrive\Desktop\exactspare\backend
node scripts/seedDemoShop.js
```
*Demo Owner Credentials:*
- **Email:** `owner.demo@exactspare.com`
- **Password:** `OwnerExactSpare@2026`

*System Administrator Credentials:*
- **Email:** `admin@exactspare.com`
- **Password:** `AdminExactSpare@2026`

### Start Backend Development Server (Port 5000)
```powershell
cd c:\Users\tarun\OneDrive\Desktop\exactspare\backend
npm run dev
```

### Start Frontend Client (Port 5173)
```powershell
cd c:\Users\tarun\OneDrive\Desktop\exactspare\frontend
npm run dev
```

### Build Frontend Production Bundle
```powershell
cd c:\Users\tarun\OneDrive\Desktop\exactspare\frontend
npm run build
```

---

## 6. Security Hardening & Production Architecture

The EXACTSPARE platform implements layered, defense-in-depth protections designed for zero-trust production operation:

### 1. HTTP Security Headers (Helmet)
- **Content Security & Sniffing Protection**: Powered by `helmet()`, protecting against MIME-type confusion, clickjacking (`X-Frame-Options`), and cross-site scripting.
- **Cross-Origin Resource Policy (CORP)**: Explicitly configured with `crossOriginResourcePolicy: { policy: 'cross-origin' }` to allow external frontends and mobile clients to load public storefront and spare-part images from the backend without browser blocking.

### 2. Strict CORS Allowlisting
- **Origin Whitelisting**: Restricts API access exclusively to the configured `FRONTEND_URL` (or `CLIENT_URL`) origin and local development hosts.
- **Credentialed Cookies**: Configured with `credentials: true` and strict method allowlisting (`GET, POST, PUT, DELETE, PATCH, OPTIONS`).

### 3. Tiered Rate Limiting (`express-rate-limit`)
- **Authentication Limiter (`authLimiter`)**: Strictly caps login and registration attempts to 30 requests per 15 minutes per IP address to thwart brute-force password guessing and automated registration attacks.
- **Order Placement Limiter (`orderLimiter`)**: Limits order creation to 35 requests per 15 minutes per IP to prevent cart flooding, rapid fake orders, and stock exhaustion attacks.
- **General API Limiter (`apiLimiter`)**: Caps overall public API traffic at 600 requests per 15 minutes per IP to guard server resources against scraping and DDoS.

### 4. Production Environment Validation (`config/env.js`)
- **Fail-Fast Boot**: When `NODE_ENV === 'production'`, the server verifies critical variables (`MONGODB_URI`, `JWT_SECRET`, `FRONTEND_URL`) before binding to the port. If any variable is missing or if `JWT_SECRET` matches development fallback defaults, the process terminates immediately with an explicit diagnostic message.

### 5. Secure Session Cookies (`utils/jwt.js`)
- **HttpOnly Enforcement**: Cookie tokens are completely inaccessible to client-side JavaScript, neutralizing token theft via XSS.
- **Production Flags**: In production (`NODE_ENV === 'production'`), `secure: true` (HTTPS only) and `sameSite: 'none'` (cross-site secure cookie passing) are applied automatically. Optional `COOKIE_DOMAIN` support allows cross-subdomain sharing.

### 6. File Upload Sandboxing (`utils/upload.js`)
- **Randomized Naming**: All uploaded files are assigned cryptographic random hex suffixes (`prefix-timestamp-hex.ext`), preventing original filename collision and script execution attacks.
- **MIME & Extension Whitelist**: Only authenticated image types (`.jpg, .jpeg, .png, .webp`) and verification document types (`.pdf, .jpg, .jpeg, .png`) are accepted. Executables, scripts, and HTML files are rejected.
- **Directory Traversal Guard**: Document downloads verify that requested file paths strictly reside within the base upload directory. Private business documents (`uploads/documents/`) are **never** exposed statically and require authenticated owner or administrator clearance via `GET /api/shop-applications/:id/documents/:filename`.

### 7. Production Log Sanitization (`utils/logger.js`)
- **Credential Redaction**: Recursive log sanitizer inspects every logged object and automatically masks passwords, token hashes, JWT strings, bearer headers, and cookies with `[REDACTED]`.

---

## 7. Production Deployment Guide

### A. Managed MongoDB Atlas Setup
1. **Create an Atlas Cluster**: Sign in to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) and deploy a free M0 sandbox or dedicated cluster.
2. **Database User**: Create a dedicated database user (e.g. `exactspare_app`) with `readWriteAnyDatabase` or scoped read/write permissions on the `exactspare` database.
3. **Network Access**: Add your backend server's static IP to the Atlas IP Access List, or use `0.0.0.0/0` (with strong password protection) for dynamic container hosts like Render/Railway.
4. **Connection String**: Copy the SRV URI:
   ```text
   mongodb+srv://<username>:<password>@cluster0.mongodb.net/exactspare?retryWrites=true&w=majority
   ```

### B. Backend Hosting (Render / Railway / DigitalOcean / Docker)
1. **Build & Start Commands**:
   - **Build Command:** `npm install`
   - **Start Command:** `node server.js`
2. **Environment Variables**:
   | Variable | Example Value | Description |
   | :--- | :--- | :--- |
   | `NODE_ENV` | `production` | Enables production mode and strict security |
   | `PORT` | `5000` (or assigned by host) | Port for the HTTP server |
   | `MONGODB_URI` | `mongodb+srv://...` | MongoDB Atlas production connection string |
   | `JWT_SECRET` | *(64-char random string)* | Strong cryptographic key for session signing |
   | `FRONTEND_URL` | `https://exactspare.vercel.app` | URL of the deployed React client |
   | `COOKIE_DOMAIN` | *(optional)* | Shared domain for cross-subdomain cookies |
3. **Persistent Local Uploads Consideration**:
   > [!IMPORTANT]
   > The existing application uses local disk storage (`backend/uploads/`). Free container platforms (e.g. standard Render free tier) utilize ephemeral filesystems that reset on redeployment. For persistent production local storage, attach a **Persistent Disk Volume** mounted at `/app/backend/uploads` (supported natively on Render Disks, Railway Volumes, and DigitalOcean Droplets). For multi-instance horizontal scaling, the disk storage abstraction can be mapped to S3/MinIO compatible object stores without modifying frontend API contracts.

### C. Frontend Hosting (Vercel / Netlify / Cloudflare Pages)
1. **Root Directory**: `frontend`
2. **Build Settings**:
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
3. **Environment Variables**:
   | Variable | Example Value | Description |
   | :--- | :--- | :--- |
   | `VITE_API_BASE_URL` | `https://exactspare-api.onrender.com/api` | Full URL to the backend `/api` endpoint |
4. **SPA Rewrite Rule (Single Page App routing)**:
   - For **Vercel** (`vercel.json`):
     ```json
     {
       "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
     }
     ```
   - For **Netlify** (`_redirects` in `frontend/public/`):
     ```text
     /*    /index.html   200
     ```

### D. Post-Deployment Verification Checklist
- [ ] `GET /api/health` returns `{ "status": "ok", "database": { "connected": true } }`.
- [ ] User registration and login successfully issue HttpOnly session cookies over HTTPS.
- [ ] Shop application submission uploads images and private documents securely.
- [ ] Map and location search (`/api/search/nearby-parts`) correctly geocodes and calculates distance.
- [ ] Shopping cart persists items, checkout places orders, and stock atomically updates.
- [ ] Admin dashboard overview renders live MongoDB aggregates and financial reports.
- [ ] Ordinary users receive HTTP 403 Forbidden when attempting to access `/api/admin/*` endpoints.

---

## 8. GitHub Best Practices & Credential Safeguards

### Git Repository Cleanliness
- **`.env` and secrets**: The project `.gitignore` explicitly excludes all `.env`, `.env.*`, SSL private keys (`*.key`, `*.pem`), and logs from being committed.
- **Upload Exclusions**: Actual uploaded customer files (`backend/uploads/*/*`) are excluded from Git, while `.gitkeep` files ensure directory structure exists upon cloning.
- **Credential Rotation Notice**: If a secret or database password was ever committed to any Git repository or publicly exposed in the past, simply deleting the file from subsequent commits does **not** erase it from Git commit history. Always immediately rotate the compromised credential (e.g. Atlas database password, JWT signing secret, API key) in the corresponding provider console.

---

## 9. Verification Results & Health Checks

### Module 8: Admin Analytics, Reports & Governance Test Suite (16/16 Passed — 100%)
```text
✔ [PASS 1] Admin successfully viewed overview dashboard with authentic MongoDB aggregates
✔ [PASS 2] Access control verified: Customers and Shop Owners strictly blocked from Admin APIs (HTTP 403)
✔ [PASS 3] Sales analytics accurately reflected delivered orders (Completed: ₹35,000)
✔ [PASS 4] Order status distribution accurately segmented DELIVERED vs other states
✔ [PASS 5] Products analytics categorized parts across vehicle types and inventory stock metrics
✔ [PASS 6] Admin successfully deactivated shop with recorded compliance reason
✔ [PASS 7] Integrity check: Products from deactivated shops are strictly excluded from public search
✔ [PASS 8] Admin successfully reactivated shop back to active marketplace state
✔ [PASS 9] Admin successfully suspended and reactivated user account with documented reasons
✔ [PASS 10] Critical safety rule enforced: Accidental suspension of the last active platform administrator strictly rejected (HTTP 400)
✔ [PASS 11] Admin successfully moderated and unpublished suspicious spare part listing
✔ [PASS 12] Admin successfully restored verified spare part listing to catalog
✔ [PASS 13] Admin hid inappropriate review; SparePart rating automatically recalculated (totalReviews: 0)
✔ [PASS 14] Platform audit log successfully recorded 10 administrative events
✔ [PASS 15] Cross-role security verified: Ordinary users denied access to Audit Logs (HTTP 403)
✔ [PASS 16] Zero regressions: Modules 1–7 (Auth, Inventory, Orders, Notifications, Wishlist) operate seamlessly
```

### Module 7: Notifications, Wishlist, Reviews & Ratings Test Suite (24/24 Passed — 100%)
```text
✔ [PASS 1] Customer notification automatically generated upon order placement (ORDER_PLACED)
✔ [PASS 2] Shop owner notification automatically generated for new incoming order (NEW_ORDER_RECEIVED)
✔ [PASS 3] GET /api/notifications/unread-count returns verified unread tally (1)
✔ [PASS 4] PATCH /api/notifications/:id/read successfully marks notification as read
✔ [PASS 5] Cross-user notification isolation: Customer 2 blocked from modifying Customer 1's notification
✔ [PASS 6] PATCH /api/notifications/read-all cleanly clears all unread notifications for recipient
✔ [PASS 7] DELETE /api/notifications/:id removes notification securely from database
✔ [PASS 8] Cross-user deletion rejection: Customer 2 blocked from deleting Shop Owner's notification
✔ [PASS 9] POST /api/wishlist/items successfully added product to customer wishlist
✔ [PASS 10] Duplicate wishlist addition safely handled without duplicate entries in MongoDB
✔ [PASS 11] GET /api/wishlist returns populated spare parts, verified pricing (₹1,800), and shop details
✔ [PASS 12] Wishlist persistence verified in MongoDB across queries
✔ [PASS 13] Move to Cart successfully transferred item from wishlist to cart and cleared from wishlist
✔ [PASS 14] DELETE /api/wishlist/items/:productId removes item cleanly from wishlist
✔ [PASS 15] Strict verification: Review rejected with HTTP 403 when order has not reached DELIVERED state
✔ [PASS 16] Verified customer submitted review successfully for delivered product (5 stars)
✔ [PASS 17] Duplicate review attempt for the same product and order rejected with HTTP 400
✔ [PASS 18] Shop owner strictly prohibited from reviewing their own product (HTTP 403 Forbidden)
✔ [PASS 19] Invalid rating (7 stars) strictly rejected with HTTP 400 validation error
✔ [PASS 20] GET /api/products/:productId/reviews accurately calculates average rating (5.0), total reviews (1), and distribution
✔ [PASS 21] Author successfully edited their review and SparePart average rating recalculated (5.0 → 4.0)
✔ [PASS 22] Cross-user review edit blocked with HTTP 403 (Customer 2 cannot modify Customer 1's review)
✔ [PASS 23] Author deleted review successfully; product ratings cleanly reset to 0
✔ [PASS 24] Zero regressions: Module 2 Auth, Module 5 Search, and Module 6 Orders continue operating seamlessly
```

### Module 6: Cart, Checkout, Orders & Management Test Suite (18/18 Passed — 100%)
```text
✔ [PASS 1] Added product to cart with revalidated pricing and subtotal (2 × ₹1,500 = ₹3,000)
✔ [PASS 2] Updated cart quantity to 3 and removed item successfully (Subtotal: ₹4,500)
✔ [PASS 3] Cart successfully persists in MongoDB across sessions/refreshes
✔ [PASS 4] Quantity exceeding available stock strictly rejected with HTTP 400
✔ [PASS 5] Placed COD order successfully with server-generated unique ID (EXS-20261015-XXXXXX)
✔ [PASS 6] Backend accurately calculated server-side total (₹7,500) from MongoDB product prices
✔ [PASS 7] Stock atomically decreased exactly once: Part A (10 → 7), Part C (3 → 2)
✔ [PASS 8] Order rejected with HTTP 400 when stock was insufficient at checkout time
✔ [PASS 9] Order submission with empty cart rejected safely with HTTP 400
✔ [PASS 10] Cross-customer order access blocked with HTTP 403 Forbidden (Ownership verified)
✔ [PASS 11] Multi-tenant owner isolation verified: Owner 2 only sees their own shop's items in multi-shop order
✔ [PASS 12] Owner successfully progressed fulfillment status from PLACED → CONFIRMED → PROCESSING
✔ [PASS 13] Invalid status transition (e.g. PROCESSING → DELIVERED) strictly rejected with HTTP 400
✔ [PASS 14] Customer cancellation accepted in PLACED status and stock restored exactly once (3 → 5)
✔ [PASS 15] Cancellation rejected with HTTP 400 when order has reached or passed dispatch state
✔ [PASS 16] Empty cart queries and DELETE /api/cart return clean zero totals without crashing
✔ [PASS 17] Zero regressions: Module 2 Auth and Module 5 Search APIs continue running smoothly
✔ [PASS 18] Customer orders endpoint returns safe payloads without exposing sensitive credentials
```

### Module 5: Location-Based Search Test Suite (17/17 Passed — 100%)
```text
✔ [PASS 1] Search by part name successfully returned matching product
✔ [PASS 2] Search by exact part number returned targeted product
✔ [PASS 3] Filtered by vehicle type "Bike" successfully (3 parts found)
✔ [PASS 4] Filtered by compatible make ("Hyundai") and model ("Swift") accurately
✔ [PASS 5] Filtered by category and price range (₹600 - ₹700) matching Castrol Oil
✔ [PASS 6] Geospatial query returned 3 nearby parts in Pune (Mumbai shop excluded by 25km radius)
✔ [PASS 7] Invalid coordinates and missing longitude rejected safely with HTTP 400
✔ [PASS 8] Metadata endpoint returns real database categories and compatible makes
✔ [PASS 9] Products from suspended shops are strictly excluded from search results
✔ [PASS 10] Draft and unpublished listings (isPublished: false) are strictly excluded
✔ [PASS 11] inStock=true successfully filtered out zero-stock Spark Plug while retaining in-stock Wiper Blades
✔ [PASS 12] Sorted results by price ascending (price_asc) and distance (distance) correctly
✔ [PASS 13] General search without location handled gracefully (distanceKm: null, hasLocation: false)
✔ [PASS 14] Pagination functions without duplication
✔ [PASS 15] Handled empty matches cleanly (total: 0) and rejected inverted prices / excessive radius (HTTP 400)
✔ [PASS 16] Shop details verified with valid GeoJSON coordinates and directions link: https://www.google.com/maps/dir/?api=1&destination=18.5204,73.8567
✔ [PASS 17] Confirmed authentic mathematical distance (120.2 km, expected ~120.2 km) and real database stock values
```

### Module 4: Shop & Inventory Test Suite (16/16 Passed — 100%)
```text
✔ [PASS 1] Approved owner can view and update their own shop profile
✔ [PASS 2] Unapproved owner is blocked from publishing inventory (HTTP 403)
✔ [PASS 3] Owner cannot edit another owner's shop (tenant isolation enforced)
✔ [PASS 4] Valid spare part listing created successfully with compatibility specs (HTTP 201)
✔ [PASS 5] Invalid negative prices and negative stock quantities rejected (HTTP 400)
✔ [PASS 6] Valid product image stored and accessible via static route (GET /uploads/parts/...)
✔ [PASS 7] Invalid vehicle types and invalid enums strictly rejected (HTTP 400)
✔ [PASS 8] Product image paths stored as clean relative paths in MongoDB
✔ [PASS 9] Owner can update their own inventory pricing and stock levels
✔ [PASS 10] Owner cannot modify another owner's product (Cross-tenant protection verified)
✔ [PASS 11] Products with zero stock automatically transition to OUT_OF_STOCK
✔ [PASS 12] Draft listings (isPublished: false) do not appear in public marketplace searches
✔ [PASS 13] Products from suspended or unapproved shops are strictly excluded from public discovery
✔ [PASS 14] Product deletion performs safe archival preserving historical references
✔ [PASS 15] Public shop and product APIs do not expose private documents or sensitive owner contact info
✔ [PASS 16] Owner inventory overview returns accurate aggregated inventory metrics and pagination
```

### Module 3: Shop Application & Admin Approval Test Suite (16/16 Passed — 100%)
```text
✔ [PASS 1] Owner can create an application draft successfully
✔ [PASS 2] Missing required fields (e.g. storefront photos) rejected with HTTP 400
✔ [PASS 3] Application submission changes status to PENDING with submittedAt timestamp
✔ [PASS 4] Duplicate active application rejected with HTTP 400
✔ [PASS 5] Owner can see their own application status and details
✔ [PASS 6] Owner cannot access another owner's application (HTTP 403 Forbidden)
✔ [PASS 7] Customer role cannot submit a shop application (HTTP 403 Forbidden)
✔ [PASS 8] Owner cannot access admin review endpoints (HTTP 403 Forbidden)
✔ [PASS 9] Admin can approve a pending application and corresponding active Shop record is created
✔ [PASS 10] Admin can reject an application with a mandatory rejection reason
✔ [PASS 11] Admin can request corrections with a descriptive message
✔ [PASS 12] Invalid status transitions (e.g. approving a DRAFT without submission) are rejected
✔ [PASS 13] Approved shops become immediately eligible for public listing (GET /api/shops)
✔ [PASS 14] Pending, draft, and rejected shops are strictly excluded from public listings
✔ [PASS 15] Private verification documents are restricted strictly to application owner and admin
✔ [PASS 16] In-app notifications and database audit histories recorded safely for all lifecycle events
```

### Module 2: Authentication & RBAC Test Suite (15/15 Passed — 100%)
```text
✔ [PASS 1] Customer registration succeeds and returns safe user object
✔ [PASS 2] Owner registration succeeds with OWNER role
✔ [PASS 3] Duplicate registration is rejected with HTTP 409 Conflict
✔ [PASS 4] Invalid inputs rejected with HTTP 400 and validation error array
✔ [PASS 5] Passwords are verified to be stored strictly as bcrypt hashes in MongoDB
✔ [PASS 6] Correct login succeeds, issuing signed HttpOnly JWT cookie and safe user payload
✔ [PASS 7] Incorrect login fails safely with generic error without disclosing account existence
✔ [PASS 8] Logout clears the authentication cookie safely
✔ [PASS 9] GET /api/auth/me returns current user profile without passwordHash
✔ [PASS 10] Customer cannot access owner or admin endpoints (HTTP 403 Forbidden)
✔ [PASS 11] Owner cannot access admin endpoints (HTTP 403 Forbidden) but accesses owner endpoints (HTTP 200)
✔ [PASS 12] Public registration cannot create an ADMIN account (HTTP 403/400 Forbidden)
✔ [PASS 13] Protected routes restore session from HttpOnly cookie on page refresh
✔ [PASS 14] Unauthenticated requests to protected APIs are blocked with HTTP 401 Unauthorized
✔ [PASS 15] Invalid or tampered tokens are rejected with HTTP 401 Unauthorized
```

---

## 10. Module 10: AI Spare-Parts Assistant, Smart Recommendations & Product Comparison

### Overview
Module 10 introduces intelligent natural-language vehicle spare-parts search and comparison while strictly maintaining database ground truth:
1. **AI Provider Abstraction (`aiProvider.js`)**: Configurable adapter supporting Google Gemini (`GEMINI_API_KEY`) and OpenAI (`OPENAI_API_KEY`) with an 8-second request abort timeout.
2. **Rule-Based NLP Fallback (`nlpSearchFallback.js`)**: Operates 100% autonomously without external API keys or during cloud outages. Parses vehicle type, make, model, year, category, and budget thresholds.
3. **Verified Catalog Search Tool (`catalogSearchTool.js`)**: Strictly queries MongoDB for `isPublished: true`, `isArchived: false`, `isModerated: false`, and active/approved shops. Never fabricates products or inventory.
4. **Smart Recommendations (`recommendationService.js`, `<SmartRecommendations />`)**: Surfaces compatible alternatives, alternative brands, and relevant category parts on the Homepage and Product Details pages.
5. **Specification Comparison (`productCompareService.js`, `<ProductCompareModal />`, `/compare`)**: Allows customer side-by-side comparison of 2 to 4 parts with lowest-price badge and spec matrix.

### Module 10 Endpoints
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/ai/assistant` | Natural language chat assistant querying real catalog (rate-limited via `aiLimiter`) |
| `GET` | `/api/ai/status` | Reports AI provider configuration status and fallback mode |
| `GET` | `/api/recommendations` | Smart compatible recommendations based on product/category/vehicle |
| `POST` | `/api/products/compare` | Compares 2 to 4 products and returns verified specification matrix |

### Module 10 Test Suite Results (12/12 Passed — 100%)
```text
TEST 1: Search for an existing spare part using natural language
  ✓ Assistant endpoint returned HTTP 200
  ✓ Response status is success: true
  ✓ Assistant returned a conversational response string
  ✓ Assistant returned products array
  ✓ Assistant found matching products for Honda Activa
  ✓ Results contain brake pads for Honda Activa

TEST 2: Ask a question with missing vehicle details
  ✓ Assistant endpoint returned HTTP 200 for vague query
  ✓ Response marked success
  ✓ Returned missingDetails list
  ✓ Identified missing vehicle type, make, or model
  ✓ Returned helpful follow-up prompt chips

TEST 3: Verify that returned products exist in MongoDB
  ✓ Verified products exist in MongoDB

TEST 4: Verify that unpublished parts and unapproved shops are excluded
  ✓ Unpublished part is strictly excluded from results
  ✓ Part from unapproved shop is strictly excluded from results
  ✓ Recommendations returned HTTP 200
  ✓ Unpublished part excluded from recommendations
  ✓ Part from unapproved shop excluded from recommendations

TEST 5: Check that prices and stock reflect current database values
  ✓ Returned price matches MongoDB price
  ✓ Returned stock matches MongoDB stock

TEST 6: Test budget filters and vehicle compatibility
  ✓ Budget query returned HTTP 200
  ✓ Found products within budget
  ✓ Product price is within requested budget (<= ₹1000)
  ✓ Product vehicleType is compatible

TEST 7: Compare two to four products
  ✓ Compare 2 products returned HTTP 200
  ✓ Compare marked success
  ✓ Returned 2 verified products in matrix
  ✓ Metrics count matches 2
  ✓ Correctly identified lowest priced product
  ✓ Computed correct price difference
  ✓ Compare 3 products returned HTTP 200
  ✓ Returned 3 verified products in matrix
  ✓ Compare 4 products returned HTTP 200
  ✓ Returned 4 verified products in matrix
  ✓ Compare 1 product rejected with HTTP 400 Bad Request
  ✓ Compare 5 products rejected with HTTP 400 Bad Request

TEST 8: Handle unavailable AI configuration
  ✓ AI status endpoint returned HTTP 200
  ✓ isConfigured is boolean
  ✓ Explicitly states fallback mode: rule_based_nlp
  ✓ Assistant operates smoothly in fallback mode without crashing
  ✓ Fallback assistant returned success: true

TEST 9: Handle provider timeout and API errors
  ✓ Handled message without unhandled promise rejection or crash
  ✓ Returned successful payload with verified inventory

TEST 10: Confirm API keys never appear in frontend code or client responses
  ✓ No Google Gemini key leaked in API response
  ✓ No OpenAI key leaked in API response
  ✓ apiKey property not exposed to client
  ✓ Scanned frontend/src: Zero API keys or secrets detected

TEST 11: Test rate limits and invalid requests
  ✓ Empty message rejected with HTTP 400
  ✓ Missing message rejected with HTTP 400
  ✓ Oversized message (>2000 chars) rejected with HTTP 400

TEST 12: Verify that Modules 1–9 continue working
  ✓ System Health check returned HTTP 200
  ✓ Public shops endpoint returned HTTP 200
  ✓ Shops array returned
  ✓ Spare parts search endpoint returned HTTP 200
  ✓ Parts array returned
```

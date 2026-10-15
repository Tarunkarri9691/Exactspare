# EXACTSPARE — Vehicle Spare Parts Finder

> **Module 5: Location-Based Spare-Part Search & Geospatial Discovery Engine**  
> Complete enterprise-grade location-based vehicle spare parts discovery platform. Features geospatial radius search on MongoDB `2dsphere` indexes, great-circle distance calculation via the Haversine formula, interactive Leaflet/OpenStreetMap markers with custom automotive SVG pins, browser Geolocation API with graceful denial fallbacks, OpenStreetMap Nominatim city/pincode geocoding with in-memory caching, reusable VehicleSelector with verified compatibility badges, multi-criteria filtering, price and distance sorting, and turn-by-turn external directions integration.

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

---

## 5. Development & Execution (Windows PowerShell)

### Run All 4 Automated Test Suites (64 Total Scenarios)
```powershell
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

## 6. Verification Results

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

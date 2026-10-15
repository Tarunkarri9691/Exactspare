# EXACTSPARE — Vehicle Spare Parts Finder

> **Module 4: Shop Management & Spare Parts Inventory System**  
> Complete enterprise-grade multi-tenant merchant inventory management, catalog publishing, vehicle compatibility specification, and public spare parts discovery engine. Built on Express.js, MongoDB/Mongoose, and React 18 + Vite with strict cross-tenant isolation, automated stock status transitions, and robust automated test suites.

---

## 1. System Architecture & Role Ecosystem

EXACTSPARE connects three distinct platform roles with strict backend authorization:
- **Customer (`CUSTOMER`)**: Register, browse approved retail shops, search spare parts by vehicle compatibility (Make, Model, Year, Category), view stock levels and pricing, and locate nearby vendors.
- **Shop Owner (`OWNER`)**: Apply for retail shop verification, manage approved store profile, publish spare parts with images and vehicle compatibility specifications, track stock quantities, and adjust pricing.
- **Admin (`ADMIN`)**: Server-initialized governance role with access to compliance applications, store lifecycle controls, platform statistics, and audit oversight.

---

## 2. Technology Stack

### Frontend
- **Framework & Bundler**: React 18, Vite 6
- **Routing & Navigation**: React Router 7 with role-guarded routes (`/owner/inventory`, `/owner/inventory/new`, `/owner/inventory/:id/edit`, `/owner/shop`, `/shops`, `/parts`).
- **Interactive Maps**: Leaflet & OpenStreetMap (`leaflet` library) with custom SVG map pins and coordinate geocoding.
- **State & Session Management**: `AuthContext` restoring session from signed HttpOnly cookie on page refresh.
- **HTTP Client**: Axios with `withCredentials: true` and multipart `FormData` support for image uploads.
- **Styling**: Vanilla CSS design tokens (Navy `#0B192C`, White `#FFFFFF`, Automotive Orange `#FF6500`, Status Green `#00C851`, and Status Red `#FF4444`).

### Backend
- **Runtime & Framework**: Node.js, Express.js (ES Modules `"type": "module"`)
- **Database**: MongoDB with Mongoose ODM (indexes on `2dsphere` coordinates, `partNumber`, `shopId`, `ownerId`)
- **File Upload & Storage Architecture**:
  - `Multer` with disk storage and non-guessable random suffixes
  - **Public Storefront Photos**: Saved to `backend/uploads/shops/`, exposed statically at `/uploads/shops/`
  - **Public Spare Part Images**: Saved to `backend/uploads/parts/`, exposed statically at `/uploads/parts/`
  - **Private Verification Documents**: Saved to `backend/uploads/documents/`, **never** exposed statically. Accessible strictly through authenticated endpoint `GET /api/shop-applications/:id/documents/:filename`.
  - File restrictions: Strict MIME type validation (JPEG, PNG, WebP), 5MB file size limit.
- **Security & Authorization**:
  - `bcryptjs` password hashing (cost factor 10)
  - `jsonwebtoken` signed JWTs via HttpOnly cookies
  - `express-rate-limit` & CSRF origin validation
  - Cross-tenant validation schemas preventing unauthorized inventory tampering or shop hijacking.

---

## 3. Database Models

### 1. `SparePart` (`models/SparePart.js`) — *Module 4*
- `shopId`: ObjectId ref to Shop (indexed)
- `ownerId`: ObjectId ref to User (indexed)
- `partName`: String (required, indexed)
- `partNumber`: String (OEM or manufacturer code, indexed)
- `description`: String
- `category`: Enum `['Engine', 'Brakes', 'Transmission', 'Electrical', 'Suspension', 'Body', 'Exhaust', 'Cooling', 'Tires & Wheels', 'Accessories', 'Other']`
- `vehicleType`: Enum `['Bike', 'Car', 'Scooter', 'Bicycle', 'Other']`
- `compatibility`: Array of `{ make, model, yearFrom, yearTo, engine }`
- `manufacturer`: String (e.g. Brembo, Bosch, Exedy)
- `price`: Number (min: 0, required)
- `stockQuantity`: Number (min: 0, required, auto-transitions status to `OUT_OF_STOCK` at 0)
- `stockStatus`: Enum `['IN_STOCK', 'OUT_OF_STOCK', 'DISCONTINUED']`
- `images`: Array of relative file paths (e.g. `['/uploads/parts/...']`)
- `condition`: Enum `['NEW', 'REFURBISHED', 'USED']` (default: `NEW`)
- `warrantyMonths`: Number (default: 0)
- `isPublished`: Boolean (default: true)
- `isArchived`: Boolean (default: false, enables safe soft deletion)
- `timestamps`: `createdAt`, `updatedAt`

### 2. `Shop` (`models/Shop.js`) — *Modules 3 & 4*
- `ownerId`: ObjectId ref to User (unique, 1 active shop per owner)
- `applicationId`: ObjectId ref to ShopApplication (unique)
- `name`, `slug`, `category`, `description`
- `contact`: `{ phone, email }`
- `address`: `{ addressLine, city, state, postalCode, location: { type: 'Point', coordinates: [lng, lat] } }`
- `openingHours`: String
- `images`: Array of public image paths
- `isApproved`: Boolean (default `false`)
- `isActive`: Boolean (default `true`)

### 3. `ShopApplication` (`models/ShopApplication.js`) — *Module 3*
- Merchant onboarding application with storefront photos, private legal verification documents, status machine (`DRAFT`, `PENDING`, `APPROVED`, `REJECTED`, `NEEDS_CORRECTION`), and full audit history.

### 4. `Notification` (`models/Notification.js`)
- In-app notification dispatcher for merchant status changes, review feedback, and platform alerts.

---

## 4. API Endpoints Catalog

### Spare Parts Inventory (`/api/parts`) — *Module 4*
| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/parts` | Public | Search and filter public spare parts with multi-criteria queries |
| `GET` | `/api/parts/:id` | Public | Retrieve public details for a specific spare part |
| `GET` | `/api/parts/my` | `OWNER` | Fetch authenticated owner's full inventory with aggregated inventory metrics |
| `POST` | `/api/parts` | `OWNER` | Create new spare part listing with multipart product photos |
| `PATCH` | `/api/parts/:id` | `OWNER` | Update part details, pricing, stock levels, and compatibility |
| `DELETE` | `/api/parts/:id` | `OWNER` | Safe soft-archive spare part preserving historical references |
| `POST` | `/api/parts/:id/images` | `OWNER` | Upload additional photos to an existing spare part listing |
| `DELETE` | `/api/parts/:id/images/:imageFilename` | `OWNER` | Remove a specific image from a spare part |

### Shop Management (`/api/shops`) — *Modules 3 & 4*
| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/shops` | Public | List verified & active retail shops (`isApproved: true, isActive: true`) |
| `GET` | `/api/shops/:id` | Public | View public details of an approved shop including its catalog |
| `GET` | `/api/shops/my` | `OWNER` | Retrieve authenticated owner's approved shop profile |
| `PATCH` | `/api/shops/my` | `OWNER` | Update store description, opening hours, contact details |
| `POST` | `/api/shops/my/images` | `OWNER` | Upload storefront and showroom gallery images |
| `PATCH` | `/api/shops/:id/status` | `ADMIN` | Suspend or reactivate a shop |

### Shop Application Endpoints (`/api/shop-applications`) — *Module 3*
| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/shop-applications` | `OWNER` | Create or update draft application with multipart uploads |
| `GET` | `/api/shop-applications/my` | `OWNER` | Retrieve authenticated owner's active application status |
| `GET` | `/api/shop-applications/:id` | `OWNER` / `ADMIN` | Retrieve specific application details and review history |
| `POST` | `/api/shop-applications/:id/submit` | `OWNER` | Validate all mandatory fields and transition status to `PENDING` |
| `GET` | `/api/shop-applications/:id/documents/:filename` | `OWNER` / `ADMIN` | Secure streaming of private verification documents |

### Admin Applications Management (`/api/admin`) — *Module 3*
| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/admin/shop-applications` | `ADMIN` | Paginated listing of all applications with status filters |
| `GET` | `/api/admin/shop-applications/:id` | `ADMIN` | Complete application dossier with storefront photos and docs |
| `PATCH` | `/api/admin/shop-applications/:id/decision` | `ADMIN` | Process decision: `APPROVE`, `REJECT`, or `REQUEST_CORRECTIONS` |

---

## 5. Development & Execution (Windows PowerShell)

### Run All Test Suites (47 Automated Verification Scenarios)
```powershell
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

### Module 4: Shop & Inventory Test Suite (16/16 Passed)
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

### Module 3: Shop Application & Admin Approval Test Suite (16/16 Passed)
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

### Module 2: Authentication & RBAC Test Suite (15/15 Passed)
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

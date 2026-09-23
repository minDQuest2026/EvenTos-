# 🎟️ QR Entry System — Freshers Got Latent 2026 (`FGL-2026`)

A cryptographically secure, tamper-proof, and concurrency-safe QR ticketing and gate entry redemption system built with **Node.js, Express, Prisma, PostgreSQL, React, and Vite**.

---

## 📌 Core Invariant & Approach

```text
One Attendee ──► One Ticket per Event ──► One Successful Redemption
```

- **Backend is the Single Source of Truth**: The frontend never creates tickets, issues signatures, or decides pass validity.
- **Asymmetric Cryptography (Ed25519)**: Every issued QR token is digitally signed on the server using Node's native `crypto` module. A private key remains strictly on the server; public keys verify token authenticity and prevent forging or tampering.
- **Replay Protection**: Screenshots or copied QR codes may be shared, but only the first scan will be approved. Every subsequent attempt is immediately rejected with a **"PASS ALREADY USED"** error and full audit trace.
- **Atomic Database Redemption**: Database updates use atomic SQL execution (`UPDATE "Ticket" ... WHERE status = 'ACTIVE' RETURNING id`) to prevent race conditions across concurrent gates.
- **Privacy by Design**: No Personally Identifiable Information (PII) like phone numbers, emails, or payment UTRs are embedded in the QR code. The QR token contains only opaque references (`event`, `ticketCode`, `nonce`, `iat`, `kid`).

---

## 🏗️ System Architecture

```mermaid
sequenceDiagram
    autonumber
    actor Attendee as 🎟️ Attendee
    participant Client as 💻 React Frontend
    participant Server as ⚡ Express Backend
    participant Crypto as 🔐 Ed25519 Crypto Engine
    participant DB as 🗄️ PostgreSQL Database
    actor Staff as 🛡️ Gate Staff

    %% Pass Retrieval
    Attendee->>Client: Open /attendee/pass
    Client->>Server: GET /api/audience/pass
    Server->>DB: Verify Attendee (Approved & Verified)
    Server->>DB: Get or create Ticket (Idempotent)
    Server->>Crypto: Sign canonical payload (v=1, event, ticket, nonce, iat, kid)
    Crypto-->>Server: Signed Token (FGL1.<payload>.<sig>)
    Server-->>Client: Return Pass & QR Token
    Client-->>Attendee: Display Pass & SVG QR Code

    %% Gate Scan 1
    Staff->>Client: Scan Pass at /gate
    Client->>Server: POST /api/gate/redeem
    Server->>Crypto: Verify Ed25519 Signature
    Server->>DB: 16 Sequential Validation Checks
    Server->>DB: Atomic UPDATE status = 'REDEEMED' WHERE status = 'ACTIVE'
    Server-->>Client: 200 OK — ENTRY APPROVED
    Client-->>Staff: ✅ Big Emerald Banner & Confetti

    %% Gate Scan 2 (Replay)
    Staff->>Client: Scan Same QR Again
    Client->>Server: POST /api/gate/redeem
    Server->>DB: Check Status (Already REDEEMED)
    Server-->>Client: 400 Bad Request — PASS ALREADY USED
    Client-->>Staff: ❌ Big Crimson Banner & First Entry Timestamp
```

---

## 🔐 QR Token & Security Specifications

### 1. Canonical Payload Format
```text
v=1
event=FGL-2026
ticket=9971115f-a580-4215-a805-448c641dc220
nonce=6wG7g... (32-byte cryptographically secure random base64url)
iat=1790158800
kid=FGL-2026-01
```

### 2. Final Signed QR Token Structure
```text
FGL1.<base64url-canonical-payload>.<base64url-ed25519-signature>
```

### 3. 16-Step Gate Redemption Verification Pipeline
1. Authenticate gate staff credentials.
2. Check gate permissions.
3. Parse token structure (`FGL1` prefix, 3 delimited parts).
4. Validate payload encoding.
5. Verify Ed25519 digital signature against active public key.
6. Verify event code match (`FGL-2026`).
7. Query ticket record by `ticketCode`.
8. Validate ticket existence in central database.
9. Match cryptographic `nonce` with stored ticket record.
10. Check ticket status (reject if `REDEEMED`, `BLOCKED`, `REVOKED`, or `EXPIRED`).
11. Check attendee registration status (`APPROVED`).
12. Check attendee payment status (`VERIFIED`).
13. Execute atomic SQL update (`SET status = 'REDEEMED' WHERE status = 'ACTIVE'`).
14. Log `EntryAttempt` record (`ENTRY_APPROVED` or failure reason).
15. Log `AuditLog` event (`ENTRY_CONFIRMED` or `ENTRY_REJECTED`).
16. Return redemption response with attendee details and timestamp.

---

## 📁 Repository Structure

```text
qr-entry-system/
├── backend/
│   ├── prisma/
│   │   └── schema.prisma         # PostgreSQL models & indexes
│   ├── scripts/
│   │   ├── seed.js               # Seed test users, events, and gates
│   │   └── test-flows.js         # Automated 26-assertion test runner
│   ├── src/
│   │   ├── controllers/
│   │   │   ├── authController.js     # Dev login & user switcher
│   │   │   ├── audienceController.js # Pass retrieval & idempotent generation
│   │   │   └── gateController.js     # 16-step gate redemption
│   │   ├── lib/
│   │   │   ├── authMiddleware.js     # Dev auth extraction
│   │   │   └── prisma.js             # Prisma client singleton
│   │   ├── routes/
│   │   │   ├── authRoutes.js
│   │   │   ├── audienceRoutes.js
│   │   │   ├── gateRoutes.js
│   │   │   └── index.js
│   │   ├── services/
│   │   │   ├── cryptoService.js      # Ed25519 signing & verification
│   │   │   ├── ticketService.js      # Pass generation & atomic redemption
│   │   │   └── auditService.js       # AuditLog & EntryAttempt recording
│   │   └── server.js                 # Express server & CORS
│   ├── .env.example
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Navbar.jsx            # App navigation & active user badge
│   │   │   ├── ProtectedRoute.jsx    # Role-based route guard
│   │   │   ├── QRDisplay.jsx         # SVG QR Code renderer & copy helper
│   │   │   └── QRScanner.jsx         # Camera scanner (html5-qrcode) & manual fallback
│   │   ├── context/
│   │   │   └── AuthContext.jsx       # Dev session & authentication context
│   │   ├── pages/
│   │   │   ├── Login.jsx             # 1-click test user switcher
│   │   │   ├── AttendeePass.jsx      # Holographic digital pass & live status
│   │   │   └── GateScanner.jsx       # Scanner interface & outcome modal banners
│   │   ├── services/
│   │   │   └── api.js                # Centralized fetch client
│   │   ├── styles.css                # Festival pass styling, dark mode & animations
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── .env.example
│   └── package.json
│
├── .gitignore
└── README.md
```

---

## 🚀 Setup & Installation

### Prerequisites
- **Node.js**: v18+ (tested on Node v22)
- **npm**: v9+
- **PostgreSQL**: Local PostgreSQL or Supabase cloud instance

---

### Step 1: Backend Setup

1. Open a terminal and navigate to the backend:
   ```bash
   cd backend
   npm install
   ```

2. Configure environment variables:
   ```bash
   cp .env.example .env
   ```
   Update `.env` with your database connection URLs:
   ```env
   # Connection URL (Pooled connection for Supabase or direct for local PostgreSQL)
   DATABASE_URL="postgresql://user:password@localhost:5432/qrentry?schema=public"

   # Direct URL (Used for Prisma migrations & schema sync)
   DIRECT_URL="postgresql://user:password@localhost:5432/qrentry?schema=public"

   PORT=5000
   QR_SIGNING_KEY_ID="FGL-2026-01"
   QR_SIGNING_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
   QR_SIGNING_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----"
   ```
   > **Note for Supabase users**: Set `DATABASE_URL` to your pooled connection string (port `6543`) and `DIRECT_URL` to your direct database connection string (port `5432`). For local PostgreSQL, both variables can share the same connection string.

3. Push Prisma schema to the database:
   ```bash
   npm run prisma:push
   ```

4. Seed the test database:
   ```bash
   npm run prisma:seed
   ```

5. Start the backend development server:
   ```bash
   npm run dev
   ```
   Backend will be running at `http://localhost:5000`.

---

### Step 2: Frontend Setup

1. Open a second terminal and navigate to the frontend:
   ```bash
   cd frontend
   npm install
   ```

2. Configure environment variables:
   ```bash
   cp .env.example .env
   ```
   Ensure `.env` points to your backend:
   ```env
   VITE_API_URL=http://localhost:5000
   ```

3. Start the frontend Vite dev server:
   ```bash
   npm run dev
   ```
   Frontend will open at `http://localhost:5173`.

---

## 🧪 Testing the Application

### 1. Interactive UI Testing Walkthrough

1. Open **[http://localhost:5173](http://localhost:5173)** in your browser.
2. **Login as Attendee**:
   - Select **Arshal (Attendee)** and click **"Continue to Portal"**.
   - Observe the digital festival pass card for **Freshers Got Latent 2026** with <span style="color:#10b981; font-weight:bold;">● ACTIVE PASS</span> status and rendered QR Code.
   - Click **"Copy Token"** below the QR code to copy the raw signed token.
3. **Redeem at Gate**:
   - Click the Logout icon in the navigation bar.
   - Select **Gate Staff 1** and click **"Continue to Portal"** (opens `/gate`).
   - Switch to the **"Token Input / Upload"** tab (or use your camera).
   - Paste the token and click **"Verify & Redeem Token"**.
   - **Result**: Immediate <span style="color:#10b981; font-weight:bold;">✅ ENTRY APPROVED</span> banner with confetti, Attendee Name, Roll Number, Gate Name, and timestamp.
4. **Test Replay Protection**:
   - Paste the **exact same token** a second time and click **"Verify & Redeem Token"**.
   - **Result**: <span style="color:#f43f5e; font-weight:bold;">❌ ENTRY DENIED — PASS ALREADY USED</span> banner displaying the previous entry timestamp.
5. **Verify Status Synchronization**:
   - Log back in as **Arshal (Attendee)**.
   - Observe that the pass now displays <span style="color:#f43f5e; font-weight:bold;">❌ ALREADY USED</span> with a watermark overlay.

---

### 2. Automated Verification Test Suite

Run the built-in test suite to verify all cryptographic and database invariants:

```bash
cd backend
npm run test:flows
```

**Expected Output:**
```text
=======================================================
🧪 RUNNING COMPREHENSIVE BACKEND VERIFICATION FLOWS
=======================================================

--- TEST A: Attendee Pass Generation & Idempotency ---
✅ PASS: Ticket ID exists
✅ PASS: Ticket status is ACTIVE
✅ PASS: QR token format starts with FGL1.
✅ PASS: Attendee name matches
✅ PASS: Same ticket ID returned on second fetch
✅ PASS: Same QR token returned without re-generation
✅ PASS: Exactly one ticket exists in database (no duplicates)

--- TEST B: Valid Scan by Gate Staff ---
✅ PASS: Redeem response HTTP status is 200
✅ PASS: Redeem success is true
✅ PASS: Message is ENTRY APPROVED
✅ PASS: Attendee name in redemption response
✅ PASS: DB Ticket status transitioned to REDEEMED
✅ PASS: DB Ticket redeemedAt timestamp is recorded
✅ PASS: DB Ticket redeemedBy is gate staff
✅ PASS: DB Ticket redeemedGateId is gate-1
✅ PASS: EntryAttempt logged with result ENTRY_APPROVED

--- TEST C: Replay Protection (Second Scan) ---
✅ PASS: Replay response HTTP status is 400
✅ PASS: Replay success is false
✅ PASS: Replay message is PASS ALREADY USED
✅ PASS: EntryAttempt logged with result ALREADY_REDEEMED

--- TEST D: Tampered QR Token ---
✅ PASS: Tampered QR HTTP status is 400
✅ PASS: Tampered QR success is false
✅ PASS: Tampered QR message is INVALID QR

--- TEST E: Wrong Event QR Token ---
✅ PASS: Wrong event QR HTTP status is 400
✅ PASS: Wrong event success is false
✅ PASS: Wrong event message is WRONG EVENT

=======================================================
🎉 ALL TESTS PASSED! (26/26 assertions)
=======================================================
```

---

## 📡 API Reference

### `POST /api/dev/login`
- **Body**: `{ "userId": "user-attendee-1" }`
- **Response**: `{ "success": true, "user": { "id": "...", "name": "Arshal", "role": "AUDIENCE" }, "token": "..." }`

### `GET /api/audience/pass?eventCode=FGL-2026`
- **Headers**: `x-user-id: <userId>`
- **Response**:
  ```json
  {
    "success": true,
    "ticketId": "cmudxpq5o...",
    "ticketCode": "9971115f-a580-4215-a805-448c641dc220",
    "status": "ACTIVE",
    "qrToken": "FGL1.dj0xCmV2ZW50PUZHTC0yMDI2C...",
    "event": { "id": "event-2026", "code": "FGL-2026", "name": "Freshers Got Latent 2026" },
    "attendee": { "name": "Arshal", "rollNumber": "2025BCY0026" }
  }
  ```

### `POST /api/gate/redeem`
- **Headers**: `x-user-id: user-gate-1`
- **Body**: `{ "qr_token": "FGL1...", "gate_id": "gate-1" }`
- **Response (Approved)**:
  ```json
  {
    "success": true,
    "message": "ENTRY APPROVED",
    "attendee": { "name": "Arshal", "rollNumber": "2025BCY0026" },
    "gate": "Gate 1",
    "entryTime": "2026-09-23T10:15:00.000Z"
  }
  ```
- **Response (Replay / Denied)**:
  ```json
  {
    "success": false,
    "message": "PASS ALREADY USED",
    "details": {
      "firstEntry": "2026-09-23T10:15:00.000Z",
      "gate": "Gate 1"
    }
  }
  ```

---

## 📄 License
This project is open-source under the [MIT License](LICENSE).

# QR Entry System — Frontend Instructions

## 1. Goal

Build a simple JavaScript frontend for a one-time QR entry system.

There are two user types:

- Audience/Attendee: logs in and views their single QR pass.
- Gate Staff/Volunteer: logs in, scans a QR, and gets an immediate entry result.

Use the backend API described in `backend.md`.

Keep the UI simple. Do not add unnecessary features.

---

## 2. Frontend Stack

Use:

- React
- Vite
- JavaScript
- React Router
- A QR scanner library that works in the browser camera
- Plain CSS or a very small CSS setup

Do NOT use TypeScript.

Suggested setup:

```bash
npm create vite@latest frontend -- --template react
cd frontend
npm install
npm install react-router-dom
```

Install one browser QR scanner library. Pick a maintained library that supports camera scanning in modern browsers.

---

## 3. Environment

Create `.env`:

```env
VITE_API_URL=http://localhost:5000
```

Use:

```javascript
const API_URL = import.meta.env.VITE_API_URL;
```

Never put the QR signing private key or database credentials in frontend code.

---

# 4. Pages

Create these pages:

```text
/login
/attendee/pass
/gate
```

Keep them simple.

---

# 5. Login Page

For the first version, use a simple development login instead of real authentication.

The page should have:

```text
QR Entry System

Select Test User:

[ Arshal - Attendee ]
[ Gate Staff 1       ]

[ Login ]
```

The frontend sends the selected user ID and role to the backend dev-login endpoint.

Backend returns a simple session/user object.

Store only the returned development session information in browser memory or sessionStorage.

Do not implement production authentication yet.

---

# 6. Attendee Page

Route:

```text
/attendee/pass
```

Show:

```text
Freshers Got Latent 2026

Name: Arshal
Roll Number: 2025BCY0026

Status: ACTIVE

[ QR CODE ]

Show this QR at the entry gate.
```

The frontend must get the QR token/data from:

```http
GET /api/audience/pass
```

The QR image should be rendered from the returned QR token/payload.

The frontend must NOT create a ticket itself.

The backend creates the ticket and signs it.

---

# 7. Important Attendee Behavior

When the attendee opens the pass page:

```text
Load existing ticket
        ↓
If ticket exists:
    Show it
        ↓
If ticket does not exist:
    Backend creates it only if the attendee
    is approved and payment is verified
```

Do NOT generate a new permanent ticket every time the page opens.

The backend is the source of truth.

If the ticket is:

```text
ACTIVE
```

show:

```text
✅ Active
```

If it is:

```text
REDEEMED
```

show:

```text
❌ Already Used
```

If it is:

```text
BLOCKED
REVOKED
EXPIRED
```

show a readable rejected state.

---

# 8. QR Rendering

The backend returns a signed QR token/string.

The frontend turns that string into a QR image.

Conceptually:

```javascript
// qrToken is returned by the backend.
const qrData = qrToken;

// Use the selected QR rendering library.
renderQRCode(qrData);
```

The QR should contain only the signed ticket token.

Do NOT put these directly into the QR from the frontend:

```text
Name
Email
Phone
Roll number
Payment UTR
Supabase user ID
```

The backend retrieves attendee information from the database after verification.

---

# 9. Gate Page

Route:

```text
/gate
```

Show:

```text
Gate Scanner

Gate: Gate 1

[ CAMERA SCANNER ]

Result:
Waiting for scan...
```

The volunteer must already be logged in.

After scanning:

```text
QR
 ↓
Get scanned text
 ↓
POST /api/gate/redeem
```

Send:

```json
{
  "qr_token": "SCANNED_QR_VALUE",
  "gate_id": "gate-1"
}
```

The backend performs verification and atomic redemption.

---

# 10. Gate Result — Success

If the backend returns success:

```text
✅ ENTRY APPROVED

Attendee: Arshal
Roll Number: 2025BCY0026

Gate 1
Entry time: 14:30
```

Use a large success state.

After a short delay, reset the scanner to:

```text
Waiting for next scan...
```

---

# 11. Gate Result — Already Used

If backend says the ticket is already redeemed:

```text
❌ ENTRY DENIED

PASS ALREADY USED
```

Optionally display:

```text
First entry: 14:30
Gate: Gate 1
```

Only return this information to authenticated gate staff.

Then reset the scanner.

---

# 12. Other Rejections

Display simple messages:

```text
INVALID QR
WRONG EVENT
TICKET REVOKED
TICKET BLOCKED
TICKET EXPIRED
PAYMENT NOT VERIFIED
REGISTRATION NOT APPROVED
```

Do not display internal stack traces or database errors.

---

# 13. API Helper

Create one small API utility:

```javascript
// Central helper for all backend requests.
export async function apiRequest(path, options = {}) {
  const response = await fetch(`${import.meta.env.VITE_API_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    ...options
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Request failed");
  }

  return data;
}
```

Keep API calls out of random UI components when possible.

---

# 14. Frontend Folder Structure

Use something simple:

```text
frontend/
├── src/
│   ├── components/
│   │   ├── QRDisplay.jsx
│   │   └── QRScanner.jsx
│   │
│   ├── pages/
│   │   ├── Login.jsx
│   │   ├── AttendeePass.jsx
│   │   └── GateScanner.jsx
│   │
│   ├── services/
│   │   └── api.js
│   │
│   ├── App.jsx
│   ├── main.jsx
│   └── styles.css
│
├── .env
└── package.json
```

Do not create unnecessary folders.

---

# 15. Dummy Users

Use these backend records for development.

### Attendee

```text
id: user-attendee-1
name: Arshal
email: arshal@test.local
rollNumber: 2025BCY0026
role: AUDIENCE
```

### Gate Staff

```text
id: user-gate-1
name: Gate Staff 1
email: gate1@test.local
role: GATE_STAFF
```

### Admin

```text
id: user-admin-1
name: Admin
email: admin@test.local
role: ADMIN
```

---

# 16. Dummy Event

```text
id: event-2026
code: FGL-2026
name: Freshers Got Latent 2026
```

---

# 17. Dummy Attendee

```text
event: event-2026
user: user-attendee-1

registrationStatus: APPROVED
paymentStatus: VERIFIED
```

This attendee must be allowed to receive a ticket.

---

# 18. Dummy Gate

```text
id: gate-1
eventId: event-2026
name: Gate 1
```

Assign:

```text
user-gate-1
```

to Gate 1 through whatever simple development authorization mechanism the backend uses.

---

# 19. Required End-to-End Demo

Antigravity must make this exact demo work.

### Test 1 — Create ticket

Login as:

```text
user-attendee-1
```

Open:

```text
/attendee/pass
```

Expected:

```text
ACTIVE
QR visible
```

Refresh the page.

Expected:

```text
Same ticket
Same QR
```

Do NOT create a second ticket.

---

### Test 2 — Scan valid QR

Login as:

```text
user-gate-1
```

Open:

```text
/gate
```

Scan the attendee QR.

Expected:

```text
✅ ENTRY APPROVED
```

Database should change:

```text
status: ACTIVE
```

to:

```text
status: REDEEMED
```

and save:

```text
redeemedAt
redeemedBy
redeemedGateId
```

---

### Test 3 — Scan same QR again

Scan the exact same QR.

Expected:

```text
❌ ENTRY DENIED
PASS ALREADY USED
```

Database must remain:

```text
status: REDEEMED
```

---

### Test 4 — Close and reopen attendee page

Logout.

Login again as:

```text
user-attendee-1
```

Open:

```text
/attendee/pass
```

Expected:

```text
Same original ticket
Status: REDEEMED
```

No new ticket must be generated.

---

# 20. Important Frontend Rules

1. Frontend never decides whether a QR is valid.
2. Frontend never creates a ticket.
3. Frontend never contains the Ed25519 private key.
4. Frontend only displays the attendee's ticket returned by the backend.
5. Gate frontend only sends the scanned QR to the backend.
6. Backend response determines success/failure.
7. Keep the UI simple and readable.
8. Do not add payment UI, Google Forms, admin dashboards, or production authentication in this first version.

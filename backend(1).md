# QR Entry System — Backend Instructions

## 1. Goal

Build a simple JavaScript backend for the QR entry system.

Use:

- Node.js
- Express
- JavaScript
- Prisma 7
- PostgreSQL through Supabase
- Node's built-in `crypto` module for Ed25519 signing
- QR generation on the backend or return the signed QR token to the frontend

The backend is the source of truth.

The critical rule is:

```text
One attendee
    ↓
One ticket per event
    ↓
One successful redemption
```

A copied/screenshot QR may be shared, but after the first successful entry every later attempt must fail.

---

# 2. Project Structure

Use:

```text
backend/
├── src/
│   ├── controllers/
│   ├── routes/
│   ├── services/
│   ├── lib/
│   └── server.js
│
├── prisma/
│   └── schema.prisma
│
├── scripts/
│   └── seed.js
│
├── .env
├── prisma.config.ts
└── package.json
```

Keep the folder structure simple.

---

# 3. Environment Variables

Create:

```env
DATABASE_URL="SUPABASE_POOLED_CONNECTION"
DIRECT_URL="SUPABASE_DIRECT_CONNECTION"

PORT=5000

# Ed25519 signing key in PEM/encoded form.
QR_SIGNING_PRIVATE_KEY="DEV_PRIVATE_KEY"

# Public key used for verification.
QR_SIGNING_PUBLIC_KEY="DEV_PUBLIC_KEY"

# Identifier for the currently active signing key.
QR_SIGNING_KEY_ID="FGL-2026-01"
```

Never commit `.env`.

Never send the private key to the frontend.

Never store the private key in the QR.

Never return the private key in an API response.

---

# 4. Database

Use Prisma with PostgreSQL.

The main models are:

```text
User
Event
Attendee
Ticket
Gate
EntryAttempt
AuditLog
```

The design should support:

- One attendee per event registration.
- One ticket per attendee per event.
- Ticket states.
- Ticket nonce.
- Ticket redemption.
- Gate information.
- Every scan attempt.
- Audit events.

---

# 5. User Model

Fields:

```text
id
email
name
rollNumber
role
createdAt
updatedAt
```

Roles:

```text
AUDIENCE
GATE_STAFF
ADMIN
```

For this first version, authentication can be a simple development login.

Do not build production authentication yet.

---

# 6. Event Model

Fields:

```text
id
code
name
createdAt
updatedAt
```

Example:

```text
id: event-2026
code: FGL-2026
name: Freshers Got Latent 2026
```

---

# 7. Attendee Model

Fields:

```text
id
eventId
userId
registrationStatus
paymentStatus
createdAt
updatedAt
```

Statuses:

```text
registrationStatus:
PENDING
APPROVED
REJECTED
```

```text
paymentStatus:
PENDING
VERIFIED
FAILED
```

Constraint:

```text
UNIQUE(eventId, userId)
```

Only an attendee with:

```text
registrationStatus = APPROVED
AND
paymentStatus = VERIFIED
```

can receive a ticket.

---

# 8. Ticket Model

Use:

```text
id
eventId
attendeeId
ticketCode
nonce
status
issuedAt
expiresAt
redeemedAt
redeemedBy
redeemedGateId
revokedAt
revokedBy
revocationReason
signingKeyId
createdAt
updatedAt
```

Ticket statuses:

```text
ACTIVE
REDEEMED
BLOCKED
REVOKED
EXPIRED
```

Constraints:

```text
UNIQUE(eventId, attendeeId)
UNIQUE(eventId, ticketCode)
```

Indexes:

```text
ticketCode
eventId + status
attendeeId
```

Do not use predictable ticket codes such as:

```text
ticket-1
ticket-2
ticket-3
```

---

# 9. Ticket ID and Nonce

Generate both using cryptographically secure randomness.

Use Node's built-in crypto.

Example:

```javascript
import crypto from "node:crypto";

// Generate a random ticket identifier.
const ticketCode = crypto.randomUUID();

// Generate a cryptographically secure nonce.
const nonce = crypto.randomBytes(32).toString("base64url");
```

The ticket ID must not be sequential.

The nonce must be unpredictable.

---

# 10. Ticket Creation Rule

Ticket creation must happen only on the backend.

Frontend must NEVER directly create a ticket.

When the attendee requests their pass:

```text
Find attendee
    ↓
Check registration
    ↓
Check payment
    ↓
Find existing ticket
```

If ticket exists:

```text
Return existing ticket
```

If no ticket exists and attendee is approved + payment verified:

```text
Create ticket once
```

If not approved/paid:

```text
Reject ticket creation
```

---

# 11. QR Payload

Create a canonical payload:

```text
v=1
event=FGL-2026
ticket=<ticketCode>
nonce=<nonce>
iat=<issuedAtUnixTimestamp>
kid=FGL-2026-01
```

Do not put:

```text
name
email
phone
roll number
payment UTR
Supabase user ID
```

inside the QR.

The QR should act as a secure ticket reference.

---

# 12. Ed25519 Signing

Use Node's built-in `crypto` module.

Generate an Ed25519 key pair for development.

Conceptually:

```javascript
import crypto from "node:crypto";

// Create a development Ed25519 key pair.
// For production, load the private key from a secure secret store.
const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519");
```

Sign the exact canonical payload:

```javascript
// Sign the canonical payload with the backend-only private key.
const signature = crypto.sign(
    null,
    Buffer.from(payload),
    privateKey
);
```

Verify using the public key:

```javascript
// Verify that the QR was signed by our trusted backend.
const valid = crypto.verify(
    null,
    Buffer.from(payload),
    publicKey,
    signature
);
```

Important:

- Private key stays server-side.
- Public key is safe for verification.
- Never expose private key to frontend.
- Never store private key in Git.
- Never place private key in QR.
- Use `signingKeyId`/`kid` in the payload.

---

# 13. Final QR Token

Use one simple format:

```text
FGL1.<base64url-payload>.<base64url-signature>
```

Example shape:

```text
FGL1.eyJ2IjoxLCJldmVudCI6IkZHTC0yMDI2I...AbCdEf...
```

The exact encoding can be implemented with base64url.

The important property is:

```text
payload + signature
```

If the payload is modified, signature verification must fail.

---

# 14. GET Audience Pass

Endpoint:

```http
GET /api/audience/pass
```

The development login supplies the current user.

Backend:

```text
Get logged-in user
    ↓
Find attendee for current event
    ↓
Check registration/payment
    ↓
Find existing ticket
    ↓
If missing → create exactly one
    ↓
Create signed QR token
    ↓
Return ticket information
```

Response example:

```json
{
  "ticketId": "ticket-uuid",
  "status": "ACTIVE",
  "qrToken": "FGL1....",
  "attendee": {
    "name": "Arshal",
    "rollNumber": "2025BCY0026"
  }
}
```

Do not return private signing information.

---

# 15. Development Login

For testing only, create:

```http
POST /api/dev/login
```

Request:

```json
{
  "userId": "user-attendee-1"
}
```

or:

```json
{
  "userId": "user-gate-1"
}
```

Return:

```json
{
  "user": {
    "id": "user-attendee-1",
    "name": "Arshal",
    "role": "AUDIENCE"
  }
}
```

For the first version, a simple development session mechanism is acceptable.

Clearly mark it as DEVELOPMENT ONLY.

---

# 16. Gate Redemption

Use:

```http
POST /api/gate/redeem
```

Request:

```json
{
  "qr_token": "SCANNED_QR_VALUE",
  "gate_id": "gate-1"
}
```

The backend must perform all checks.

---

# 17. Gate Redemption Checks

Run these in order:

```text
1. Authenticate gate staff
2. Check gate permission
3. Parse QR token
4. Validate token structure
5. Verify Ed25519 signature
6. Check event ID
7. Find ticket
8. Check ticket exists
9. Check nonce
10. Check ticket status
11. Check registration status
12. Check payment status
13. Check revoked status
14. Check blocked status
15. Check expiration
16. Atomically redeem
```

Any failure must reject the entry.

---

# 18. Atomic Redemption

This is the most important database operation.

Never do:

```text
SELECT ticket
↓
if active
↓
UPDATE ticket
```

as two unprotected operations.

The final redemption must be an atomic update.

Conceptually:

```sql
UPDATE tickets
SET
    status = 'REDEEMED',
    redeemed_at = NOW(),
    redeemed_by = :staff_id,
    redeemed_gate_id = :gate_id
WHERE
    id = :ticket_id
    AND event_id = :event_id
    AND status = 'ACTIVE'
RETURNING id;
```

If one row is returned:

```text
ENTRY APPROVED
```

If zero rows are returned:

```text
ENTRY REJECTED
```

This guarantees that two gates cannot redeem the same active ticket successfully.

Implement this through Prisma using a transaction/raw SQL operation as appropriate for the final project.

---

# 19. Entry Attempts

Every scan attempt must create an `EntryAttempt`.

Possible results:

```text
VALIDATED
ENTRY_APPROVED
ALREADY_REDEEMED
INVALID_SIGNATURE
UNKNOWN_TICKET
WRONG_EVENT
BLOCKED
REVOKED
EXPIRED
PAYMENT_NOT_VERIFIED
REGISTRATION_NOT_APPROVED
```

Record:

```text
eventId
ticketId
gateId
staffId
attemptedAt
result
failureReason
deviceId
metadata
```

If the QR is so malformed that no ticket can be identified, `ticketId` can be null.

---

# 20. Audit Logs

Record important actions:

```text
TICKET_CREATED
TICKET_SIGNED
PASS_VIEWED
QR_SCANNED
ENTRY_CONFIRMED
ENTRY_REJECTED
TICKET_BLOCKED
TICKET_UNBLOCKED
TICKET_REVOKED
ADMIN_OVERRIDE
```

For each audit event store:

```text
eventId
entityId
action
actorId
timestamp
gateId
deviceId
metadata
```

Do not implement the advanced tamper-evident audit hash chain in the first simple version.

Keep the normal audit log first.

---

# 21. Routes

Implement these in the first version:

```text
POST /api/dev/login
GET  /api/audience/pass
POST /api/gate/redeem
```

Later add admin operations:

```text
POST /api/admin/tickets/generate
POST /api/admin/tickets/revoke
POST /api/admin/tickets/block
```

Do not build the admin UI yet.

---

# 22. Dummy Data

Seed these records.

### Users

```text
user-attendee-1
name: Arshal
email: arshal@test.local
rollNumber: 2025BCY0026
role: AUDIENCE
```

```text
user-gate-1
name: Gate Staff 1
email: gate1@test.local
role: GATE_STAFF
```

```text
user-admin-1
name: Admin
email: admin@test.local
role: ADMIN
```

### Event

```text
id: event-2026
code: FGL-2026
name: Freshers Got Latent 2026
```

### Attendee

```text
userId: user-attendee-1
eventId: event-2026
registrationStatus: APPROVED
paymentStatus: VERIFIED
```

### Gate

```text
id: gate-1
eventId: event-2026
name: Gate 1
```

---

# 23. Required Test

After implementation, this exact flow must work.

## Test A — Attendee gets pass

Login:

```text
user-attendee-1
```

Call:

```http
GET /api/audience/pass
```

Expected:

```text
200 OK
status = ACTIVE
QR token exists
```

Call it again.

Expected:

```text
same ticket ID
same ticket
same QR token
```

Do not create a second ticket.

---

## Test B — Valid scan

Login as:

```text
user-gate-1
```

Call:

```http
POST /api/gate/redeem
```

with:

```json
{
  "qr_token": "THE_ATTENDEE_QR_TOKEN",
  "gate_id": "gate-1"
}
```

Expected:

```json
{
  "success": true,
  "message": "ENTRY APPROVED"
}
```

Database:

```text
status = REDEEMED
redeemedAt = non-null
redeemedBy = user-gate-1
redeemedGateId = gate-1
```

---

## Test C — Replay same QR

Send the exact same QR again.

Expected:

```json
{
  "success": false,
  "message": "PASS ALREADY USED"
}
```

Create an entry attempt:

```text
result = ALREADY_REDEEMED
```

---

## Test D — Tamper with QR

Take the QR token and modify one character.

Send it to the redeem endpoint.

Expected:

```text
INVALID QR
```

The digital signature must fail.

---

## Test E — Wrong event

Create or simulate a token signed for another event.

Expected:

```text
WRONG EVENT
```

---

# 24. Important Rules

- Backend is always the source of truth.
- Frontend never creates or authorizes tickets.
- Never trust values sent by the scanner without verification.
- Never expose the signing private key.
- Ticket creation is once per attendee per event.
- A valid ticket can be redeemed exactly once.
- Redemption must be atomic.
- Every scan attempt should be logged.
- Use the same central PostgreSQL database for every gate.
- Do not implement offline redemption in this version.
- Do not implement screenshot prevention. A copied QR can be used once, then replay fails.
- Do not implement college-ID verification.
- The first valid scan immediately redeems the ticket and allows entry.

---

# 25. Simple Development Commands

Install:

```bash
npm install
```

Create/update database:

```bash
npx prisma migrate dev --name init
```

Generate Prisma client:

```bash
npx prisma generate
```

Run seed:

```bash
node scripts/seed.js
```

Start backend:

```bash
npm run dev
```

Start frontend separately:

```bash
npm run dev
```

---

# 26. Definition of Done for the MVP

The first MVP is complete only when this works end-to-end:

```text
Attendee login
    ↓
GET existing ticket
    ↓
QR displayed
    ↓
Gate staff login
    ↓
Camera scans QR
    ↓
Backend verifies signature
    ↓
Backend verifies ticket/event/payment/status
    ↓
Atomic redemption
    ↓
✅ Entry approved
    ↓
Same QR scanned again
    ↓
❌ Entry denied
```

That is the core system.

Do not add unrelated features until this exact flow is working.

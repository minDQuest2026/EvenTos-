import crypto from "node:crypto";
import dotenv from "dotenv";

dotenv.config();

// Helper to normalize PEM keys that might have escaped newlines in .env
function formatPemKey(rawKey) {
  if (!rawKey) return null;
  return rawKey.replace(/\\n/g, "\n").trim();
}

const PRIVATE_KEY_PEM = formatPemKey(process.env.QR_SIGNING_PRIVATE_KEY);
const PUBLIC_KEY_PEM = formatPemKey(process.env.QR_SIGNING_PUBLIC_KEY);
const KEY_ID = process.env.QR_SIGNING_KEY_ID || "FGL-2026-01";

let privateKeyObject;
let publicKeyObject;

try {
  if (PRIVATE_KEY_PEM) {
    privateKeyObject = crypto.createPrivateKey({
      key: PRIVATE_KEY_PEM,
      format: "pem"
    });
  }
  if (PUBLIC_KEY_PEM) {
    publicKeyObject = crypto.createPublicKey({
      key: PUBLIC_KEY_PEM,
      format: "pem"
    });
  }
} catch (err) {
  console.warn("Failed to load Ed25519 keys from .env. Generating fallback in-memory keypair for development.", err);
  const fallback = crypto.generateKeyPairSync("ed25519");
  privateKeyObject = fallback.privateKey;
  publicKeyObject = fallback.publicKey;
}

/**
 * Generate cryptographically secure random ticket code (UUID v4)
 */
export function generateTicketCode() {
  return crypto.randomUUID();
}

/**
 * Generate cryptographically secure random nonce (base64url)
 */
export function generateNonce(bytes = 32) {
  return crypto.randomBytes(bytes).toString("base64url");
}

/**
 * Build the canonical payload string
 *
 * Example:
 * v=1
 * event=FGL-2026
 * ticket=<ticketCode>
 * nonce=<nonce>
 * iat=<issuedAtUnixTimestamp>
 * kid=FGL-2026-01
 */
export function buildCanonicalPayload({ eventCode, ticketCode, nonce, iat, kid = KEY_ID }) {
  const lines = [
    `v=1`,
    `event=${eventCode}`,
    `ticket=${ticketCode}`,
    `nonce=${nonce}`,
    `iat=${iat}`,
    `kid=${kid}`
  ];
  return lines.join("\n");
}

/**
 * Sign canonical payload and generate final QR token
 * Format: FGL1.<base64url-payload>.<base64url-signature>
 */
export function signQrPayload({ eventCode, ticketCode, nonce, issuedAt, kid = KEY_ID }) {
  const iat = Math.floor(new Date(issuedAt).getTime() / 1000);
  const canonicalPayload = buildCanonicalPayload({ eventCode, ticketCode, nonce, iat, kid });

  const payloadBuffer = Buffer.from(canonicalPayload, "utf8");
  const signature = crypto.sign(null, payloadBuffer, privateKeyObject);

  const payloadB64Url = payloadBuffer.toString("base64url");
  const sigB64Url = signature.toString("base64url");

  const qrToken = `FGL1.${payloadB64Url}.${sigB64Url}`;
  return {
    qrToken,
    canonicalPayload,
    payloadB64Url,
    sigB64Url
  };
}

/**
 * Parse and verify QR token with Ed25519 signature
 */
export function verifyQrToken(qrToken, customPublicKey = publicKeyObject) {
  if (!qrToken || typeof qrToken !== "string") {
    return { valid: false, reason: "INVALID_STRUCTURE", error: "QR token missing or invalid format" };
  }

  const parts = qrToken.trim().split(".");
  if (parts.length !== 3 || parts[0] !== "FGL1") {
    return { valid: false, reason: "INVALID_STRUCTURE", error: "Invalid token format, expected FGL1.<payload>.<sig>" };
  }

  const [, payloadB64Url, sigB64Url] = parts;

  let payloadText;
  let signatureBuffer;
  try {
    payloadText = Buffer.from(payloadB64Url, "base64url").toString("utf8");
    signatureBuffer = Buffer.from(sigB64Url, "base64url");
  } catch {
    return { valid: false, reason: "INVALID_ENCODING", error: "Token base64url decoding failed" };
  }

  // Verify Ed25519 digital signature
  let isSignatureValid = false;
  try {
    isSignatureValid = crypto.verify(null, Buffer.from(payloadText, "utf8"), customPublicKey, signatureBuffer);
  } catch (err) {
    return { valid: false, reason: "INVALID_SIGNATURE", error: "Signature verification error", details: err.message };
  }

  if (!isSignatureValid) {
    return { valid: false, reason: "INVALID_SIGNATURE", error: "Digital signature is invalid or token has been tampered with" };
  }

  // Parse canonical payload lines
  const parsed = {};
  const lines = payloadText.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx !== -1) {
      const key = trimmed.slice(0, eqIdx);
      const val = trimmed.slice(eqIdx + 1);
      parsed[key] = val;
    }
  }

  if (!parsed.v || !parsed.event || !parsed.ticket || !parsed.nonce) {
    return { valid: false, reason: "MALFORMED_PAYLOAD", error: "Payload is missing mandatory fields" };
  }

  return {
    valid: true,
    payload: {
      version: parsed.v,
      eventCode: parsed.event,
      ticketCode: parsed.ticket,
      nonce: parsed.nonce,
      iat: parsed.iat ? parseInt(parsed.iat, 10) : null,
      kid: parsed.kid
    },
    rawPayload: payloadText
  };
}

export const cryptoService = {
  generateTicketCode,
  generateNonce,
  buildCanonicalPayload,
  signQrPayload,
  verifyQrToken
};

export default cryptoService;

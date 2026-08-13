/**
 * The license token format: what it means and how it is signed, shared by the
 * server (signs) and the app (verifies).
 *
 * A token is a JSON object of plain fields plus a 64-byte Ed25519 signature
 * (base64url) over a canonical ASCII message rebuildable byte-for-byte on both
 * sides. The server signs only after Jokoor reports the checkout succeeded AND
 * the amount/currency match the hardcoded price. Nothing here is secret.
 */

export interface LicensePayload {
  /** Format version — bumping it invalidates every old token. */
  v: 1;
  license: '7to9-premium';
  /** Jokoor checkout session id this entitlement was purchased through. */
  sessionId: string;
  /** Price paid, in minor units (2500 = D25.00). */
  amount: number;
  currency: 'GMD';
  /** Epoch seconds of issue; used to reject stale re-signed tokens. */
  issuedAt: number;
}

export interface LicenseToken extends LicensePayload {
  sig: string; // base64url, 64 bytes
}

function esc(value: string | number): string {
  return encodeURIComponent(String(value));
}

/**
 * The exact bytes the signature covers. ASCII only, so both runtimes
 * (@noble/curves asciiToBytes in the app, TextEncoder on the server) produce
 * identical output. Never change the field order or encoding without bumping
 * `v`.
 */
export function licenseMessage(payload: LicensePayload): string {
  return [
    `v=${esc(payload.v)}`,
    `license=${esc(payload.license)}`,
    `sessionId=${esc(payload.sessionId)}`,
    `amount=${esc(payload.amount)}`,
    `currency=${esc(payload.currency)}`,
    `issuedAt=${esc(payload.issuedAt)}`,
  ].join('&');
}

export function parseLicenseToken(raw: string): LicenseToken | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    const token = parsed as Partial<LicenseToken>;
    if (
      token.v !== 1 ||
      token.license !== '7to9-premium' ||
      typeof token.sessionId !== 'string' ||
      typeof token.amount !== 'number' ||
      token.currency !== 'GMD' ||
      typeof token.issuedAt !== 'number' ||
      typeof token.sig !== 'string'
    ) {
      return null;
    }
    // Old lifetimes are fine (one-time purchase), but a token dated in the
    // future or older than the app itself is a forgery smell.
    const nowSec = Math.floor(Date.now() / 1000);
    if (token.issuedAt > nowSec + 300) return null;
    return token as LicenseToken;
  } catch {
    return null;
  }
}
/**
 * The client half of the license gate: talks to the payment backend (Expo
 * Router API routes) and verifies the signed entitlement locally.
 *
 * The backend holds the Jokoor sk_* key, hardcodes the price, and signs
 * Ed25519 tokens only after Jokoor confirms payment. This file only ever sees
 * public values: the backend origin and the verification public key.
 */

import { ed25519 } from '@noble/curves/ed25519.js';
import { asciiToBytes, hexToBytes } from '@noble/curves/utils.js';

import { API_ORIGIN, CHECKOUT_ENDPOINT, LICENSE_PUBLIC_KEY_HEX, STATUS_ENDPOINT } from '@/constants/license';
import { licenseMessage, parseLicenseToken } from '@/utils/license-token';
import {
  getLicenseRecord,
  getPendingPayments,
  removePendingPayment,
  saveLicenseRecord,
  savePendingPayment,
  type PendingPayment,
} from '@/utils/storage';

export interface CheckoutSession {
  sessionId: string;
  url: string;
  /** Price in minor units (2500 = D25.00) — returned by the server, never assumed. */
  amountMinor: number;
}

export interface StatusResult {
  status: 'pending' | 'paid' | 'failed' | 'cancelled';
  token: string | null;
}

export class LicenseUnavailableError extends Error {}

function base64urlToBytes(input: string): Uint8Array | null {
  try {
    const b64 = input.replace(/-/g, '+').replace(/_/g, '/');
    const padded = b64.padEnd(b64.length + ((4 - (b64.length % 4)) % 4), '=');
    const bin = atob(padded);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  } catch {
    return null;
  }
}

/**
 * Cryptographically checks a stored token. This is the entire security model
 * of the offline gate: no token the server did not sign (i.e. no payment that
 * did not happen) can pass, no matter what is written to AsyncStorage.
 */
export function verifyToken(tokenText: string): boolean {
  const token = parseLicenseToken(tokenText);
  if (!token) return false;

  const publicKey = hexToBytes(LICENSE_PUBLIC_KEY_HEX);
  const sig = base64urlToBytes(token.sig);
  if (!sig || sig.length !== 64) return false;
  return ed25519.verify(sig, asciiToBytes(licenseMessage(token)), publicKey);
}

export function isAPIReady(): boolean {
  return API_ORIGIN.length > 0;
}

/**
 * True when a valid (server-signed) license is stored locally. One-time
 * purchase: no expiry.
 */
export async function hasValidLicense(): Promise<boolean> {
  const record = await getLicenseRecord();
  return record ? verifyToken(record.token) : false;
}

/** Asks the backend for the current price (minor units) — never hardcoded. */
export async function getPrice(): Promise<number> {
  if (!isAPIReady()) throw new LicenseUnavailableError('The payment server is not connected.');
  const response = await fetch(`${API_ORIGIN}${CHECKOUT_ENDPOINT}`);
  if (!response.ok) throw new Error(`Could not load the price (${response.status}).`);
  const data: unknown = await response.json();
  if (!data || typeof data !== 'object') throw new Error('Could not load the price.');
  const amount = (data as { amountMinor?: unknown }).amountMinor;
  if (typeof amount !== 'number') throw new Error('Could not load the price.');
  return amount;
}

/** Asks the backend to create a Jokoor checkout session for the fixed price. */
export async function startCheckout(): Promise<CheckoutSession> {
  if (!isAPIReady()) throw new LicenseUnavailableError('The payment server is not connected.');
  const response = await fetch(`${API_ORIGIN}${CHECKOUT_ENDPOINT}`, { method: 'POST' });
  if (!response.ok) throw new Error(`Could not start payment (${response.status}).`);
  const data: unknown = await response.json();
  if (!data || typeof data !== 'object') throw new Error('Could not start payment.');
  const body = data as { sessionId?: unknown; url?: unknown; amountMinor?: unknown };
  if (typeof body.sessionId !== 'string' || typeof body.url !== 'string') {
    throw new Error('Could not start payment.');
  }
  return {
    sessionId: body.sessionId,
    url: body.url,
    amountMinor: typeof body.amountMinor === 'number' ? body.amountMinor : 2500,
  };
}

/**
 * Asks the backend whether the Jokoor session has been paid. When it has, the
 * response carries the signed license token.
 */
export async function checkStatus(sessionId: string): Promise<StatusResult> {
  if (!isAPIReady()) throw new LicenseUnavailableError('The payment server is not connected.');
  const response = await fetch(
    `${API_ORIGIN}${STATUS_ENDPOINT}?sessionId=${encodeURIComponent(sessionId)}`
  );
  if (!response.ok) throw new Error(`Could not check payment (${response.status}).`);
  const data: unknown = await response.json();
  if (!data || typeof data !== 'object') throw new Error('Could not check payment.');
  const body = data as { status?: unknown; token?: unknown };
  const status = body.status;
  if (status !== 'pending' && status !== 'paid' && status !== 'failed' && status !== 'cancelled') {
    throw new Error('Unexpected payment state.');
  }
  return { status, token: typeof body.token === 'string' ? body.token : null };
}

/**
 * Polls the backend until the session settles. Transient network failures do
 * not abort the loop — a blip during a mobile-money flow must not kill the
 * confirmation screen.
 */
export async function pollUntilSettled(
  sessionId: string,
  intervalMs = 4000,
  maxAttempts = 40
): Promise<StatusResult> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const result = await checkStatus(sessionId);
      if (result.status !== 'pending') return result;
    } catch {
      // transient — keep polling
    }
    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }
  return { status: 'pending', token: null };
}

/** Saves the entitlement after a confirmed payment. */
export async function storeLicense(sessionId: string, token: string): Promise<void> {
  await saveLicenseRecord({ token, sessionId, obtainedAt: new Date().toISOString() });
  await removePendingPayment(sessionId);
}

/**
 * The "payment status checker" run on launch: any checkout the user started
 * but never confirmed is re-checked against the backend. A payment that
 * completed while the app was closed therefore unlocks on the next open.
 */
export async function resolvePendingPayments(): Promise<void> {
  const pending: PendingPayment[] = await getPendingPayments();
  for (const entry of pending) {
    try {
      const result = await pollUntilSettled(entry.sessionId, 4000, 8);
      if (result.status === 'paid' && result.token) {
        await storeLicense(entry.sessionId, result.token);
      }
      if (result.status === 'failed' || result.status === 'cancelled') {
        await removePendingPayment(entry.sessionId);
      }
    } catch {
      // leave it pending; the next launch (or the pay screen) will retry
    }
  }
}
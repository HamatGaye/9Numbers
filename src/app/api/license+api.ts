/**
 * The entire payment backend: create a Jokoor checkout, and hand out a signed
 * license once Jokoor confirms it was paid.
 *
 * Runs as Expo Router API routes (EAS Hosting edge). Server-only secrets come
 * from environment variables, never from the app bundle:
 *   JOKOOR_API_KEY        — sk_live_... (or sk_test_... while testing)
 *   LICENSE_PRIVATE_KEY   — base64 PKCS8 DER of the Ed25519 private key
 *   LICENSE_AMOUNT_MINOR  — price in minor units, default 2500 (D25.00).
 *                           Change ONLY this number to change the price.
 */

import { licenseMessage, type LicensePayload } from '@/utils/license-token';

const JOKOOR_BASE = 'https://api.jokoor.com/v1';
const CURRENCY = 'GMD';
const METHODS = ['wave', 'qmoney', 'afrimoney', 'card'];

const amountMinor = (): number => {
  const raw = process.env.LICENSE_AMOUNT_MINOR ?? '50';
  const value = Number(raw);
  return Number.isInteger(value) && value > 0 ? value : 50;
};

function json(response: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(response), {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
}

/* ------------------------------------------------------------- rate limit */

const HITS_PER_MINUTE = 6;
const hits = new Map<string, number[]>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const window = hits.get(ip) ?? [];
  const recent = window.filter(t => now - t < 60_000);
  if (recent.length >= HITS_PER_MINUTE) {
    hits.set(ip, recent);
    return true;
  }
  recent.push(now);
  hits.set(ip, recent);
  return false;
}

function clientIP(request: Request): string {
  return request.headers.get('cf-connecting-ip') ?? request.headers.get('x-forwarded-for') ?? 'unknown';
}

/* -------------------------------------------------------- small encodings */

function bytesFromBase64(input: string): Uint8Array<ArrayBuffer> {
  const b64 = input.replace(/-/g, '+').replace(/_/g, '/');
  const padded = b64.padEnd(b64.length + ((4 - (b64.length % 4)) % 4), '=');
  const bin = atob(padded);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function base64FromBytes(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/* ------------------------------------------------------------- Jokoor API */

interface JokoorSession {
  sessionId: string;
  url: string;
}

/** Creates a checkout session. Amount/currency are hardcoded server-side. */
async function createJokoorSession(): Promise<JokoorSession> {
  const response = await fetch(`${JOKOOR_BASE}/checkout_sessions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.JOKOOR_API_KEY ?? ''}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      amount: amountMinor(),
      currency: CURRENCY,
      methods: METHODS,
    }),
  });
  if (!response.ok) throw new Error(`Jokoor checkout failed (${response.status})`);
  const body: unknown = await response.json();
  const wrapper = body && typeof body === 'object' ? (body as Record<string, unknown>) : null;
  const data = wrapper && 'data' in wrapper && wrapper.data ? wrapper.data : body;
  if (!data || typeof data !== 'object') throw new Error('Jokoor checkout response was not understood');
  const record = data as Record<string, unknown>;
  const sessionId: unknown = record.sessionId ?? record.id ?? record.session_id ?? record.payment_id;
  const url: unknown = record.url ?? record.payment_url ?? record.checkout_url ?? record.checkoutUrl;
  if (typeof sessionId !== 'string' || typeof url !== 'string') {
    throw new Error('Jokoor checkout response was not understood');
  }
  return { sessionId, url };
}

const PAID_STATUSES = new Set(['succeeded', 'paid', 'completed', 'success']);

/** Digs through the (softly-documented) Jokoor session/payment shape. */
function dig(data: unknown, key: string, depth = 0): unknown {
  if (!data || typeof data !== 'object' || depth > 3) return undefined;
  if (Array.isArray(data)) {
    for (const item of data) {
      const found = dig(item, key, depth + 1);
      if (found !== undefined) return found;
    }
    return undefined;
  }
  const record = data as Record<string, unknown>;
  if (key in record) return record[key];
  for (const value of Object.values(record)) {
    const found = dig(value, key, depth + 1);
    if (found !== undefined) return found;
  }
  return undefined;
}

interface JokoorState {
  found: boolean;
  paid: boolean;
  amount: number | null;
  currency: string | null;
}

/** Queries Jokoor for the session's payment state, trying both endpoints. */
async function queryJokoor(sessionId: string): Promise<JokoorState> {
  const paths = [`/checkout_sessions/${sessionId}`, `/payments/${sessionId}`];
  for (const path of paths) {
    try {
      const response = await fetch(`${JOKOOR_BASE}${path}`, {
        headers: { Authorization: `Bearer ${process.env.JOKOOR_API_KEY ?? ''}` },
      });
      if (!response.ok) continue;
      const body: unknown = await response.json();
      const status = dig(body, 'status');
      const amount = dig(body, 'amount');
      const currency = dig(body, 'currency');
      const paid = typeof status === 'string' && PAID_STATUSES.has(status.toLowerCase());
      return {
        found: true,
        paid,
        amount: typeof amount === 'number' ? amount : typeof amount === 'string' ? Number(amount) : null,
        currency: typeof currency === 'string' ? currency.toUpperCase() : null,
      };
    } catch {
      // try the next endpoint
    }
  }
  return { found: false, paid: false, amount: null, currency: null };
}

/* --------------------------------------------------------- Ed25519 signing */

let signingKey: CryptoKey | null = null;

async function getSigningKey(): Promise<CryptoKey> {
  if (signingKey) return signingKey;
  const raw = process.env.LICENSE_PRIVATE_KEY;
  if (!raw) throw new Error('LICENSE_PRIVATE_KEY is not set');
  signingKey = await crypto.subtle.importKey('pkcs8', bytesFromBase64(raw), 'Ed25519', false, ['sign']);
  return signingKey;
}

async function signToken(payload: LicensePayload): Promise<string> {
  const key = await getSigningKey();
  const raw = Uint8Array.from(new TextEncoder().encode(licenseMessage(payload)));
  const signature = new Uint8Array(await crypto.subtle.sign('Ed25519', key, raw));
  const token = JSON.stringify({ ...payload, sig: base64FromBytes(signature) });
  return token;
}

/* ------------------------------------------------------------------ routes */

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, GET, OPTIONS' };

/** Starts a checkout for the fixed price. No auth: paying IS the gate. */
export async function POST(request: Request): Promise<Response> {
  if (rateLimited(clientIP(request))) {
    return json({ error: 'Too many attempts. Try again in a minute.' }, { status: 429 });
  }
  try {
    const session = await createJokoorSession();
    return json({ sessionId: session.sessionId, url: session.url, amountMinor: amountMinor() }, { headers: cors });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Payment setup failed';
    return json({ error: message }, { status: 502, headers: cors });
  }
}

/**
 * Settles a checkout: 'paid' only when Jokoor confirms it AND the amount and
 * currency still match the hardcoded price. The token is signed only then.
 */
export async function GET(request: Request): Promise<Response> {
  const sessionId = new URL(request.url).searchParams.get('sessionId');
  if (!sessionId) {
    return json({ amountMinor: amountMinor() }, { headers: cors });
  }

  try {
    const state = await queryJokoor(sessionId);
    if (!state.found) {
      return json({ status: 'pending', token: null }, { headers: cors });
    }
    if (!state.paid) {
      return json({ status: 'pending', token: null }, { headers: cors });
    }
    if (state.amount !== amountMinor() || state.currency !== CURRENCY) {
      // Paid session, wrong price — never grant. Log for the operator.
      console.error(`[license] amount mismatch session=${sessionId} got=${state.amount} ${state.currency}`);
      return json({ status: 'failed', token: null }, { headers: cors });
    }

    const token = await signToken({
      v: 1,
      license: '7to9-premium',
      sessionId,
      amount: amountMinor(),
      currency: CURRENCY,
      issuedAt: Math.floor(Date.now() / 1000),
    });
    return json({ status: 'paid', token }, { headers: cors });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Status check failed';
    return json({ error: message }, { status: 502, headers: cors });
  }
}

export function OPTIONS(): Response {
  return new Response(null, { status: 204, headers: cors });
}
/**
 * License gate configuration shared across the app.
 *
 * PUBLIC values only. The license private key and the Jokoor API key live in
 * server-side environment variables on EAS Hosting — never here, and never in
 * any EXPO_PUBLIC_ variable (those are inlined into the app bundle).
 */

/**
 * Origin of the payment backend (Expo Router API routes). Empty in development
 * until the server URL is known; the migration runs un-gated in `__DEV__`
 * builds regardless — the gate only matters in production builds.
 *
 * Set EXPO_PUBLIC_API_URL in .env during development (Metro LAN URL) — EAS
 * Builds auto-set it to the deployed origin via EXPO_UNSTABLE_DEPLOY_SERVER.
 */
export const API_ORIGIN = (process.env.EXPO_PUBLIC_API_URL ?? '').replace(/\/$/, '');

/**
 * Ed25519 public key (raw 32-byte encoding, hex) used to verify license
 * tokens locally, offline. Generated once with `node scripts/generate-keys.mjs`;
 * the matching private key is LICENSE_PRIVATE_KEY (PKCS8, base64) in server
 * secrets. Public by design — it only lets the app CHECK signatures, not
 * create them. Replace the placeholder before going live.
 */
export const LICENSE_PUBLIC_KEY_HEX = 'a6e54f278dc2476f78e2db82c0b7607c7273baf59d51dffb46bd7cae67160dffd';

export const CHECKOUT_ENDPOINT = '/api/license';

/**
 * Same route, with ?sessionId= — the server answers the price without it and
 * the payment state with it.
 */
export const STATUS_ENDPOINT = '/api/license';
/**
 * Generates the Ed25519 keypair for the license gate. Run once:
 *
 *   node scripts/generate-keys.mjs
 *
 * Output:
 *   1. LICENSE_PRIVATE_KEY — base64 PKCS8 DER. Set it as a server-only secret
 *      on EAS Hosting (`eas env:create --name LICENSE_PRIVATE_KEY ...`).
 *   2. The raw 32-byte public key (hex) — paste into
 *      LICENSE_PUBLIC_KEY_HEX in src/constants/license.ts.
 *
 * The public key is safe to embed in the app: it only verifies signatures.
 * The private key must NEVER appear in the repo, the app bundle, or .env.
 */
import { generateKeyPairSync } from 'node:crypto';
import { writeFileSync } from 'node:fs';

const { publicKey, privateKey } = generateKeyPairSync('ed25519');

const publicKeyDer = publicKey.export({ type: 'spki', format: 'der' });
const privateKeyDer = privateKey.export({ type: 'pkcs8', format: 'der' });

const rawPublicKeyHex = Buffer.from(publicKeyDer.subarray(-32)).toString('hex');
const privateKeyB64 = privateKeyDer.toString('base64');

console.log('------------------------------------------------------------------------');
console.log('Generated Ed25519 keypair for the 9Numbers license gate.');
console.log();
console.log('1) Set this server secret on EAS Hosting (never commit it):');
console.log('   LICENSE_PRIVATE_KEY=' + privateKeyB64);
console.log();
console.log('2) Paste this into LICENSE_PUBLIC_KEY_HEX in src/constants/license.ts:');
console.log('   ' + rawPublicKeyHex);
console.log('------------------------------------------------------------------------');

writeFileSync('license-private-key.pem', privateKey.export({ type: 'pkcs8', format: 'pem' }));
console.log('(Private key also written to ./license-private-key.pem — gitignored? delete it after setup.)');
/**
 * Dev-only assertion suite for the migration engine.
 * Run: npx tsx scratch.ts
 * Exit code is non-zero when any assertion fails.
 */
import { analyzeGambianNumber, nationalDigits, prettyPrint, type NumberAnalysis } from './src/utils/migration';

let failures = 0;
let passed = 0;

function check(name: string, actual: unknown, expected: unknown) {
  const ok = actual === expected;
  if (ok) {
    passed++;
  } else {
    failures++;
    console.error(`  ✗ ${name}\n    expected: ${JSON.stringify(expected)}\n    actual:   ${JSON.stringify(actual)}`);
  }
}

function analyze(raw: string): NumberAnalysis {
  return analyzeGambianNumber(raw);
}

console.log('=== operator detection (legacy 7-digit) ===');
check('Africell 7', analyze('7123456').operator, 'Africell');
check('Africell 2', analyze('2123456').operator, 'Africell');
check('Africell 40', analyze('4012345').operator, 'Africell');
check('Africell 41', analyze('4112345').operator, 'Africell');
check('QCell 3', analyze('3123456').operator, 'QCell');
check('QCell 5', analyze('5123456').operator, 'QCell');
check('Comium 6', analyze('6123456').operator, 'Comium');

console.log('=== reasons ===');
check('needs-migration', analyze('7123456').reason, 'needs-migration');
check('already-migrated 87', analyze('877123456').reason, 'already-migrated');
check('already-migrated 83', analyze('833123456').reason, 'already-migrated');
check('already-migrated 86', analyze('866123456').reason, 'already-migrated');
check('already-migrated unknown prefix 88', analyze('881123456').reason, 'already-migrated');
check('Gamcel untouched', analyze('9123456').reason, 'not-migrating');
check('Gamtel untouched', analyze('4312345').reason, 'not-migrating');
check('US number', analyze('+1 555 1234567').reason, 'foreign');
check('foreign no plus', analyze('2407123456').reason, 'foreign');
check('8-digit junk', analyze('82345678').reason, 'foreign');
check('ambiguous 8 prefix', analyze('8234567').reason, 'ambiguous');
check('empty', analyze('').reason, 'invalid');

console.log('=== migrated output (display + e164) ===');
check('bare display', analyze('7123456').display, '877123456');
check('bare e164', analyze('7123456').e164, '+220877123456');
check('+220 display', analyze('+220 7123456').display, '+220 877123456');
check('+220 e164', analyze('+220 7123456').e164, '+220877123456');
check('00220 display', analyze('00220 3123456').display, '00220 833123456');
check('220 display', analyze('2206123456').display, '220866123456');
check('leading zero', analyze('07123456').display, '877123456');
check('spaced input', analyze('7 123 456').display, '877123456');
check('QCell migration', analyze('3123456').national9, '833123456');
check('Comium migration', analyze('6123456').national9, '866123456');
check('migrated 9 stays', analyze('877768765').national9, '877768765');

console.log('=== nationalDigits (restore matching) ===');
check('nd +220 spaced', nationalDigits('+220 87 7123456'), '877123456');
check('nd +220 tight', nationalDigits('+220877123456'), '877123456');
check('nd 00220', nationalDigits('00220 877 123 456'), '877123456');
check('nd 220 prefix', nationalDigits('220877123456'), '877123456');
check('nd bare 9', nationalDigits('877123456'), '877123456');
check('nd spaced 9', nationalDigits('877 123 456'), '877123456');
check('nd legacy 7', nationalDigits('7123456'), '7123456');
check('nd legacy +220', nationalDigits('+2207123456'), '7123456');
check('nd foreign → null', nationalDigits('+447911123456'), null);
check('nd empty → null', nationalDigits(''), null);

console.log('=== prettyPrint ===');
check('pp 9-digit', prettyPrint('877123456'), '877 123 456');
check('pp 7-digit passthrough', prettyPrint('7123456'), '7123456');
check('pp already spaced', prettyPrint('877 123 456'), '877 123 456');

console.log(`\n${passed} passed, ${failures} failed`);
if (failures > 0) process.exit(1);
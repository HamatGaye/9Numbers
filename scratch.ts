/**
 * Assertion tests for the migration engine.
 *
 * Run with:  npx tsc --noEmit false --outDir .tmp-test --module commonjs \
 *              --target es2020 --skipLibCheck scratch.ts && node .tmp-test/scratch.js
 */
import { planPhoneWrite } from './src/utils/contacts';
import {
  analyzeGambianNumber,
  isSameNumber,
  migrateWithOperator,
  numberKey,
  prettyPrint,
  type MigrationReason,
  type Operator,
} from './src/utils/migration';

interface Case {
  input: string;
  reason: MigrationReason;
  operator: Operator;
  /** Expected value written back into the contact, or null for "leave alone". */
  write: string | null;
  note: string;
}

const cases: Case[] = [
  // --- Africell: 20X-29X and 70X-79X -> prefix 87 ---
  { input: '7123456', reason: 'needs-migration', operator: 'Africell', write: '877123456', note: 'Africell 7x' },
  { input: '2123456', reason: 'needs-migration', operator: 'Africell', write: '872123456', note: 'Africell 2x' },
  { input: '2901234', reason: 'needs-migration', operator: 'Africell', write: '872901234', note: 'Africell 29x' },
  { input: '7901234', reason: 'needs-migration', operator: 'Africell', write: '877901234', note: 'Africell 79x' },

  // --- QCell: 30X-39X, 50X-53X, 58X-59X -> prefix 83 ---
  { input: '3123456', reason: 'needs-migration', operator: 'QCell', write: '833123456', note: 'QCell 3x' },
  { input: '3901234', reason: 'needs-migration', operator: 'QCell', write: '833901234', note: 'QCell 39x' },
  { input: '5012345', reason: 'needs-migration', operator: 'QCell', write: '835012345', note: 'QCell 50x' },
  { input: '5312345', reason: 'needs-migration', operator: 'QCell', write: '835312345', note: 'QCell 53x' },
  { input: '5812345', reason: 'needs-migration', operator: 'QCell', write: '835812345', note: 'QCell 58x' },
  { input: '5912345', reason: 'needs-migration', operator: 'QCell', write: '835912345', note: 'QCell 59x' },

  // --- Comium: 60X-69X -> prefix 86 ---
  { input: '6123456', reason: 'needs-migration', operator: 'Comium', write: '866123456', note: 'Comium 6x' },
  { input: '6987654', reason: 'needs-migration', operator: 'Comium', write: '866987654', note: 'Comium 69x' },

  // --- Africell also holds the 4 block, per PURA's notice (87 4xxxxxx) ---
  { input: '4012345', reason: 'needs-migration', operator: 'Africell', write: '874012345', note: 'Africell 40x' },
  { input: '4112345', reason: 'needs-migration', operator: 'Africell', write: '874112345', note: 'Africell 41x' },
  { input: '4312345', reason: 'needs-migration', operator: 'Africell', write: '874312345', note: 'Africell 43x (old Gamtel block)' },
  { input: '4399601', reason: 'needs-migration', operator: 'Africell', write: '874399601', note: 'Africell 439 (old Gamtel block)' },

  // --- QCell holds all of the 5 block (83 5xxxxxx) ---
  { input: '5534567', reason: 'needs-migration', operator: 'QCell', write: '835534567', note: 'QCell 55x (old Gamtel block)' },
  { input: '5661234', reason: 'needs-migration', operator: 'QCell', write: '835661234', note: 'QCell 56x (old Gamtel block)' },
  { input: '5735678', reason: 'needs-migration', operator: 'QCell', write: '835735678', note: 'QCell 57x (old Gamtel block)' },
  { input: '5412345', reason: 'needs-migration', operator: 'QCell', write: '835412345', note: 'QCell 54x' },

  // --- Comium holds the 8 block (86 8xxxxxx) ---
  { input: '8123456', reason: 'needs-migration', operator: 'Comium', write: '868123456', note: 'Comium 8x (old Gamtel CDMA)' },

  // --- Not migrating: Gamcel 9XX only ---
  { input: '9123456', reason: 'not-migrating', operator: 'Gamcel', write: null, note: 'Gamcel 9x' },
  { input: '9987654', reason: 'not-migrating', operator: 'Gamcel', write: null, note: 'Gamcel 99x' },

  // --- Country-code styles are preserved ---
  { input: '+220 7123456', reason: 'needs-migration', operator: 'Africell', write: '+220 877123456', note: '+220 style' },
  { input: '00220 3123456', reason: 'needs-migration', operator: 'QCell', write: '00220 833123456', note: '00220 style' },
  { input: '2206123456', reason: 'needs-migration', operator: 'Comium', write: '220866123456', note: '220 no plus' },
  { input: '+220-712-3456', reason: 'needs-migration', operator: 'Africell', write: '+220 877123456', note: 'dashes' },
  { input: '(220) 712 3456', reason: 'needs-migration', operator: 'Africell', write: '220877123456', note: 'parenthesised 220' },
  { input: '07123456', reason: 'needs-migration', operator: 'Africell', write: '877123456', note: 'trunk zero' },
  { input: '7 123 456', reason: 'needs-migration', operator: 'Africell', write: '877123456', note: 'spaced' },
  { input: '+2200712 3456', reason: 'needs-migration', operator: 'Africell', write: '+220 877123456', note: '+220 then trunk zero' },

  // --- Already done ---
  { input: '877123456', reason: 'already-migrated', operator: 'Africell', write: null, note: '9-digit Africell' },
  { input: '833123456', reason: 'already-migrated', operator: 'QCell', write: null, note: '9-digit QCell' },
  { input: '866123456', reason: 'already-migrated', operator: 'Comium', write: null, note: '9-digit Comium' },
  { input: '+220 877123456', reason: 'already-migrated', operator: 'Africell', write: null, note: '9-digit international' },
  { input: '220833123456', reason: 'already-migrated', operator: 'QCell', write: null, note: '9-digit, 220 no plus' },

  // --- Prefix contradicts the subscriber number ---
  { input: '839123456', reason: 'prefix-mismatch', operator: 'QCell', write: null, note: 'QCell prefix on a Gamcel body' },
  { input: '876123456', reason: 'prefix-mismatch', operator: 'Africell', write: null, note: 'Africell prefix on a Comium body' },
  { input: '834312345', reason: 'prefix-mismatch', operator: 'QCell', write: null, note: 'QCell prefix on an Africell body' },
  { input: '868123456', reason: 'already-migrated', operator: 'Comium', write: null, note: '86 on an 8x body is consistent' },

  // --- Foreign and junk ---
  { input: '+1 555 1234567', reason: 'foreign', operator: 'Unknown', write: null, note: 'US number' },
  { input: '+221 77 123 4567', reason: 'foreign', operator: 'Unknown', write: null, note: 'Senegal' },
  { input: '00447911123456', reason: 'foreign', operator: 'Unknown', write: null, note: 'UK via 00' },
  { input: '123456789', reason: 'unknown-range', operator: 'Unknown', write: null, note: 'bare 9-digit, not our prefix' },
  { input: '+220 123456789', reason: 'unknown-range', operator: 'Unknown', write: null, note: '+220 9-digit outside the plan' },
  { input: '1122334', reason: 'unknown-range', operator: 'Unknown', write: null, note: '7-digit short-code range' },
  { input: '0123456', reason: 'unknown-range', operator: 'Unknown', write: null, note: 'leading zeros only' },
  { input: '12345', reason: 'invalid', operator: 'Unknown', write: null, note: 'too short' },
  { input: '', reason: 'invalid', operator: 'Unknown', write: null, note: 'empty' },
  { input: '   ', reason: 'invalid', operator: 'Unknown', write: null, note: 'whitespace' },
  { input: 'not a number', reason: 'invalid', operator: 'Unknown', write: null, note: 'letters' },
  { input: '*123#', reason: 'invalid', operator: 'Unknown', write: null, note: 'USSD code' },
  { input: '71234567', reason: 'unknown-range', operator: 'Unknown', write: null, note: '8 digits' },
];

let failed = 0;
let passed = 0;

function check(label: string, actual: unknown, expected: unknown) {
  if (actual === expected) {
    passed++;
    return true;
  }
  failed++;
  console.log(`  FAIL ${label}\n       expected ${JSON.stringify(expected)}\n       actual   ${JSON.stringify(actual)}`);
  return false;
}

console.log('\n=== analyzeGambianNumber ===');
for (const c of cases) {
  const a = analyzeGambianNumber(c.input);
  const ok =
    check(`${JSON.stringify(c.input)} reason (${c.note})`, a.reason, c.reason) &&
    check(`${JSON.stringify(c.input)} operator (${c.note})`, a.operator, c.operator) &&
    check(`${JSON.stringify(c.input)} write (${c.note})`, a.write, c.write) &&
    check(
      `${JSON.stringify(c.input)} needsMigration (${c.note})`,
      a.needsMigration,
      c.reason === 'needs-migration'
    );
  if (ok) console.log(`  ok   ${c.input.padEnd(18)} ${c.operator.padEnd(9)} ${c.reason.padEnd(17)} ${c.note}`);
}

console.log('\n=== idempotency: migrating twice must be a no-op ===');
for (const c of cases.filter(x => x.reason === 'needs-migration')) {
  const once = analyzeGambianNumber(c.input);
  const twice = analyzeGambianNumber(once.write!);
  check(`${c.input} -> ${once.write} is stable`, twice.needsMigration, false);
  check(`${c.input} -> ${once.write} recognised as migrated`, twice.reason, 'already-migrated');
  check(`${c.input} operator survives the round trip`, twice.operator, once.operator);
}

console.log('\n=== mayBeFixedLine flag (old Gamtel blocks) ===');
for (const input of ['4312345', '4223456', '4399601', '5534567', '5661234', '5735678', '8123456']) {
  check(`${input} is flagged`, analyzeGambianNumber(input).mayBeFixedLine, true);
  check(`${input} still migrates`, analyzeGambianNumber(input).needsMigration, true);
}
for (const input of ['4012345', '4112345', '7123456', '2123456', '3123456', '5012345', '6123456']) {
  check(`${input} is not flagged`, analyzeGambianNumber(input).mayBeFixedLine, false);
}
check('flag survives the 9-digit round trip', analyzeGambianNumber('874312345').mayBeFixedLine, true);
check('Gamcel is never flagged', analyzeGambianNumber('9123456').mayBeFixedLine, false);

console.log('\n=== e164 ===');
check('+220 7123456 -> e164', analyzeGambianNumber('+220 7123456').e164, '+220877123456');
check('6123456 -> e164', analyzeGambianNumber('6123456').e164, '+220866123456');
check('9123456 has no e164', analyzeGambianNumber('9123456').e164, null);

console.log('\n=== prettyPrint ===');
check('9-digit grouping', prettyPrint('877123456'), '877 123 456');
check('7-digit grouping', prettyPrint('7123456'), '712 3456');
check('other left alone', prettyPrint('12'), '12');

console.log('\n=== numberKey / isSameNumber ===');
check('key strips +220', numberKey('+220 877 123 456'), '877123456');
check('key strips 00220', numberKey('00220-877123456'), '877123456');
check('key of legacy', numberKey('07123456'), '7123456');
check('same across formats', isSameNumber('+220 877123456', '877 123 456'), true);
check('legacy matches migrated', isSameNumber('7123456', '877123456'), true);
check('legacy matches migrated (reversed)', isSameNumber('+220 877123456', '7123456'), true);
check('different numbers differ', isSameNumber('7123456', '7123457'), false);
check('wrong prefix does not match legacy', isSameNumber('7123456', '997123456'), false);
check('empty never matches', isSameNumber('', '877123456'), false);

console.log('\n=== migrateWithOperator (manual override) ===');
const forced = migrateWithOperator('4012345', 'Africell');
check('forced operator', forced.operator, 'Africell');
check('forced write', forced.write, '874012345');
check('forced needsMigration', forced.needsMigration, true);
const forcedIntl = migrateWithOperator('+220 4012345', 'QCell');
check('forced keeps style', forcedIntl.write, '+220 834012345');
check('cannot force a 9-digit number', migrateWithOperator('877123456', 'QCell').needsMigration, false);
check('cannot force junk', migrateWithOperator('abc', 'QCell').needsMigration, false);

console.log('\n=== planPhoneWrite: forward (migrate) ===');
{
  const migrate = { currentNumber: '7123456', newNumber: '877123456' };
  check('untouched row is written', planPhoneWrite('7123456', migrate).action, 'write');
  check(
    'reformatted row is still written',
    planPhoneWrite('+220 712 3456', migrate).action,
    'write'
  );
  check('deleted row is skipped', planPhoneWrite(undefined, migrate).action, 'skip');
  check(
    'deleted row reports missing',
    (planPhoneWrite(null, migrate) as { code: string }).code,
    'missing'
  );
  check(
    're-running after success is a no-op',
    (planPhoneWrite('877123456', migrate) as { code: string }).code,
    'already-applied'
  );
  check(
    'a row the user edited is skipped',
    (planPhoneWrite('9998888', migrate) as { code: string }).code,
    'changed'
  );
}

console.log('\n=== planPhoneWrite: reverse (undo) ===');
{
  // This is the case that used to break: the stored value and the target are
  // two forms of the SAME subscriber, so a loose equality check made undo
  // believe it was already done.
  const undo = { currentNumber: '877123456', newNumber: '7123456' };
  check('migrated row is reverted', planPhoneWrite('877123456', undo).action, 'write');
  check(
    'reformatted migrated row is reverted',
    planPhoneWrite('+220 877 123 456', undo).action,
    'write'
  );
  check(
    'already-reverted row is a no-op',
    (planPhoneWrite('7123456', undo) as { code: string }).code,
    'already-applied'
  );
  check(
    'unrelated number is not clobbered',
    (planPhoneWrite('6123456', undo) as { code: string }).code,
    'changed'
  );
  check('deleted row is skipped', (planPhoneWrite('', undo) as { code: string }).code, 'missing');
}

console.log('\n=== planPhoneWrite: full round trip ===');
{
  // Migrate, then undo, then confirm we are exactly back where we started.
  const original = '+220 712 3456';
  const analysis = analyzeGambianNumber(original);
  const migrated = analysis.write!;
  check('round trip produced a value', migrated, '+220 877123456');

  const forward = planPhoneWrite(original, {
    currentNumber: original,
    newNumber: migrated,
  });
  check('forward writes', forward.action, 'write');

  const back = planPhoneWrite(migrated, { currentNumber: migrated, newNumber: original });
  check('undo writes', back.action, 'write');

  const again = planPhoneWrite(original, { currentNumber: migrated, newNumber: original });
  check(
    'undoing twice is a no-op',
    (again as { code: string }).code,
    'already-applied'
  );
}

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) throw new Error(`${failed} migration assertion(s) failed`);

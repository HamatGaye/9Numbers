/**
 * Dev-only sanity checks for the migration engine.
 * Run: npx expo start  → or import this file in a screen temporarily.
 */
import { analyzeGambianNumber } from './src/utils/migration';

const testCases = [
  '7123456', // Africell
  '2123456', // Africell
  '4012345', // Africell
  '4112345', // Africell
  '3123456', // QCell
  '5123456', // QCell
  '6123456', // Comium
  '+220 7123456', // Africell with country code
  '00220 3123456', // QCell with 00220
  '2206123456', // Comium with 220, no plus
  '9123456', // Gamcel (No change)
  '4312345', // Gamtel (No change)
  '+1 555 1234567', // US number (No change)
  '877123456', // Already migrated
  '+220 877123456', // Already migrated, international
  '07123456', // Leading zero
  '7 123 456', // Spaced
  '2407123456', // Foreign, no plus
];

testCases.forEach(tc => {
  const r = analyzeGambianNumber(tc);
  console.log(
    `${tc.padEnd(16)} -> op=${r.operator.padEnd(8)} reason=${r.reason.padEnd(16)} display=${String(
      r.display
    ).padEnd(16)} needs=${r.needsMigration} e164=${r.e164}`
  );
});

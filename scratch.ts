import { migrateGambianNumber } from './src/utils/migration';

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
  '9123456', // Gamcel (No change)
  '4312345', // Gamtel (No change)
  '+1 555 1234567', // US number (No change)
  '877123456', // Already migrated
];

testCases.forEach(tc => {
  const res = migrateGambianNumber(tc);
  console.log(`${tc} -> ${res.migratedNumber} (Needs migration: ${res.needsMigration})`);
});

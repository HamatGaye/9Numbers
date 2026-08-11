/**
 * The Gambia 9-digit migration engine.
 *
 * From 4 September 2026 a two-digit operator prefix is added in front of every
 * 7-digit subscriber number:
 *   - Africell -> 87
 *   - QCell    -> 83
 *   - Comium   -> 86
 *
 * The dual-numbering period runs until 30 November 2026. Gamtel (fixed) and
 * Gamcel (mobile) are NOT part of the initial migration.
 *
 * Numbers are accepted in many formats: bare, spaced, dashed, +220, 00220 or
 * the national style without any country code.
 */

export type Operator = 'Africell' | 'QCell' | 'Comium' | 'Gamtel' | 'Gamcel' | 'Unknown';

export type MigrationReason =
  | 'needs-migration'   // legacy 7-digit that should get a prefix
  | 'already-migrated'  // already in 9-digit format
  | 'not-migrating'     // Gamtel / Gamcel – not part of this migration
  | 'ambiguous'         // 7-digit, no operator could be determined
  | 'foreign'           // non-Gambian number
  | 'invalid';          // unparseable / too short

export interface NumberAnalysis {
  /** Raw number as stored in the contact. */
  original: string;
  /** Is this a Gambian number at all? */
  isGambian: boolean;
  /** Operator when it could be determined. */
  operator: Operator;
  /** Why we should (or should not) touch this number. */
  reason: MigrationReason;
  /** The 7 legacy digits, when present. */
  legacyDigits: string | null;
  /** The new 9-digit national significant number, when applicable. */
  national9: string | null;
  /** E.164 representation (+220...), when applicable. */
  e164: string | null;
  /**
   * Final display string, preserving the style of the original
   * (e.g. `+220 877123456`, `00220 877123456` or bare `877123456`).
   */
  display: string | null;
  /** True when the caller should offer this number for migration. */
  needsMigration: boolean;
}

export const OPERATOR_PREFIXES: Record<Exclude<Operator, 'Unknown'>, string> = {
  Africell: '87',
  QCell: '83',
  Comium: '86',
  Gamtel: '',
  Gamcel: '',
};

export const OPERATOR_DISPLAY: Record<Operator, string> = {
  Africell: 'Africell',
  QCell: 'QCell',
  Comium: 'Comium',
  Gamtel: 'Gamtel (fixed)',
  Gamcel: 'Gamcel (mobile)',
  Unknown: 'Unknown',
};

const isDigits = (s: string) => /^\d+$/.test(s);

function operatorForLegacy7(digits: string): Operator | null {
  if (/^[27]/.test(digits) || /^4[01]/.test(digits)) return 'Africell';
  if (/^[35]/.test(digits)) return 'QCell';
  if (/^6/.test(digits)) return 'Comium';
  if (/^9/.test(digits)) return 'Gamcel';
  if (/^4[2-9]/.test(digits)) return 'Gamtel';
  return null;
}

function operatorForMigrated9(digits: string): Operator | null {
  if (/^87\d{7}$/.test(digits)) return 'Africell';
  if (/^83\d{7}$/.test(digits)) return 'QCell';
  if (/^86\d{7}$/.test(digits)) return 'Comium';
  return null;
}

interface ParseResult {
  isGambian: boolean;
  /** Leading `+220`, `00220`, `220` or null. */
  countryStyle: '+' | '00' | '220' | null;
  /** Digits after the country code (or the raw digits). */
  national: string;
}

function parseGambian(raw: string): ParseResult {
  const cleaned = raw.replace(/[^\d+]/g, '');
  if (cleaned.startsWith('+220')) {
    return { isGambian: true, countryStyle: '+', national: cleaned.slice(4).replace(/^0+/, '') };
  }
  if (cleaned.startsWith('00220')) {
    return { isGambian: true, countryStyle: '00', national: cleaned.slice(5).replace(/^0+/, '') };
  }
  if (cleaned.startsWith('220') && cleaned.length >= 10 && cleaned.length <= 12) {
    // National dialing style without `+`, e.g. 2207123456
    return { isGambian: true, countryStyle: '220', national: cleaned.slice(3) };
  }
  if (cleaned.startsWith('+') && !cleaned.startsWith('+220')) {
    // Explicit foreign country code
    return { isGambian: false, countryStyle: '+', national: cleaned.slice(1) };
  }
  const withoutLeadingZero = cleaned.replace(/^0+/, '');
  if (/^\d{7}$/.test(withoutLeadingZero) || /^\d{9}$/.test(withoutLeadingZero)) {
    // Bare 7- or 9-digit numbers are treated as Gambian national numbers.
    // This is the legacy / new format used locally in the country.
    return { isGambian: true, countryStyle: null, national: withoutLeadingZero };
  }
  if (/^\d{6,13}$/.test(cleaned)) {
    return { isGambian: false, countryStyle: null, national: cleaned };
  }
  return { isGambian: false, countryStyle: null, national: cleaned };
}

function baseAnalysis(original: string): NumberAnalysis {
  return {
    original,
    isGambian: false,
    operator: 'Unknown',
    reason: 'invalid',
    legacyDigits: null,
    national9: null,
    e164: null,
    display: null,
    needsMigration: false,
  };
}

export function analyzeGambianNumber(raw: string): NumberAnalysis {
  const result = baseAnalysis(raw);
  if (!raw || !raw.trim()) return result;

  const parsed = parseGambian(raw);
  if (!parsed.isGambian) {
    result.reason = isDigits(parsed.national) ? 'foreign' : 'invalid';
    return result;
  }

  result.isGambian = true;
  const national = parsed.national;

  // Already migrated: 9 digits, starts with an operator prefix (87/83/86).
  if (national.length === 9) {
    const op = operatorForMigrated9(national);
    result.reason = 'already-migrated';
    result.national9 = national;
    result.e164 = `+220${national}`;
    result.operator = op ?? 'Unknown';
    result.display = formatDisplay(parsed, national);
    return result;
  }

  // Legacy 7 digits.
  if (national.length === 7) {
    const op = operatorForLegacy7(national);
    result.legacyDigits = national;
    if (!op || op === 'Unknown') {
      result.reason = 'ambiguous';
      return result;
    }
    if (op === 'Gamtel' || op === 'Gamcel') {
      result.reason = 'not-migrating';
      result.operator = op;
      result.display = formatDisplay(parsed, national);
      return result;
    }
    const prefix = OPERATOR_PREFIXES[op];
    const migrated = prefix + national;
    result.reason = 'needs-migration';
    result.operator = op;
    result.national9 = migrated;
    result.e164 = `+220${migrated}`;
    result.display = formatDisplay(parsed, migrated);
    result.needsMigration = true;
    return result;
  }

  // Other lengths: 8-digit partial, 10+ digit junk, etc. Leave untouched.
  result.reason = isDigits(national) ? 'invalid' : 'invalid';
  return result;
}

function formatDisplay(parsed: ParseResult, national: string): string {
  if (parsed.countryStyle === '+') return `+220 ${national}`;
  if (parsed.countryStyle === '00') return `00220 ${national}`;
  if (parsed.countryStyle === '220') return `220${national}`;
  return national;
}

/**
 * Normalizes a stored phone number to its national 7- or 9-digit form,
 * ignoring formatting and any +220 / 00220 / 220 country-code prefix.
 * Returns null when the number is not a parseable Gambian national number.
 */
export function nationalDigits(raw: string): string | null {
  const parsed = parseGambian(raw);
  if (!parsed.isGambian || !/^\d{7,9}$/.test(parsed.national)) return null;
  return parsed.national;
}

/** Backwards-compatible helper for callers that only care about the outcome. */
export function migrateGambianNumber(raw: string): {
  needsMigration: boolean;
  migratedNumber: string;
  originalNumber: string;
  operator: Operator;
} {
  const a = analyzeGambianNumber(raw);
  return {
    needsMigration: a.needsMigration,
    migratedNumber: a.display ?? raw,
    originalNumber: raw,
    operator: a.operator,
  };
}

/** Format a 9-digit national number for human display, e.g. `877 123 456`. */
export function prettyPrint(national9: string): string {
  return national9.replace(/(\d{3})(\d{3})(\d{3})/, '$1 $2 $3');
}

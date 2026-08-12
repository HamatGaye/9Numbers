/**
 * The Gambia 7-digit -> 9-digit migration engine.
 *
 * From 4 September 2026 a two-digit operator prefix is added in front of every
 * 7-digit mobile subscriber number:
 *
 *   Africell -> 87        QCell -> 83        Comium -> 86
 *
 * The subscriber number itself never changes. Both formats work during the
 * dual-numbering period (4 Sep - 30 Nov 2026); from 1 Dec 2026 only the
 * 9-digit format completes calls and SMS.
 *
 * Gamcel (mobile) and Gamtel (fixed / CDMA) are NOT part of the initial
 * migration, so their numbers must be left completely untouched.
 *
 * ---------------------------------------------------------------------------
 * SOURCE OF THE RANGE TABLE BELOW
 *
 * LEGACY_RANGES follows PURA's public notice "Migration of the National Mobile
 * Numbering Plan from 7-Digit to 9-Digit Format", which gives the mapping as:
 *
 *   AFRICELL  87   e.g. 87 7xx xxxx,  87 4xxxxxx,  87 2xxxxxx
 *   QCELL     83   e.g. 83 3xx xxxx,  83 5xxxxxx
 *   COMIUM    86   e.g. 86 6xx xxxx,  86 8xxxxxx
 *
 * So the leading digit maps as: 2, 4, 7 -> Africell; 3, 5 -> QCell;
 * 6, 8 -> Comium; 9 -> Gamcel, which is not in this phase.
 *
 * DO NOT "correct" this against the ITU-T +220 numbering plan. That document
 * (PURA communication of 26.XI.2019) shows 4XX and 8XX as Gamtel PSTN/CDMA and
 * splits 5XX between QCell and Gamtel. It predates the reallocation and is
 * stale — following it left real Africell 4xx numbers un-migrated, which is the
 * bug this table replaced. PURA's migration notice is the authority.
 *
 * One caveat is preserved from the older plan, because it is about fixed lines
 * rather than about which operator owns a range: Gamtel geographic exchanges
 * historically sat inside 42x-49x, 55x-57x and 8xx (Banjul 42x, Serekunda 43x,
 * Soma 553, Basse 566, Farafenni 573, and PURA's own 439 9601). Numbers in those
 * blocks still migrate — PURA says they belong to migrating operators — but they
 * are flagged `mayBeFixedLine` so the review screen can mark them for a second
 * look. Prefixing a landline is one of the few ways this app can leave someone
 * unreachable, so it is worth one glance from the user.
 * ---------------------------------------------------------------------------
 */

export type Operator = 'Africell' | 'QCell' | 'Comium' | 'Gamtel' | 'Gamcel' | 'Unknown';

/** Operators whose numbers gain a prefix on 4 Sep 2026. */
export type MigratingOperator = 'Africell' | 'QCell' | 'Comium';

export type MigrationReason =
  /** Legacy 7-digit number belonging to a migrating operator. */
  | 'needs-migration'
  /** Already a valid 9-digit number. Nothing to do. */
  | 'already-migrated'
  /** Gamcel or Gamtel - deliberately left alone. */
  | 'not-migrating'
  /** 9 digits, but the prefix contradicts the subscriber number's operator. */
  | 'prefix-mismatch'
  /** Looks Gambian but falls outside every published range. */
  | 'unknown-range'
  /** A number in another country. */
  | 'foreign'
  /** Too short, too long, or not a phone number at all. */
  | 'invalid';

/** How the number was written, so we can put it back the same way. */
export type CountryStyle = '+220' | '00220' | '220' | 'national';

export interface NumberAnalysis {
  /** Exactly what was stored in the contact. */
  original: string;
  /** Is this a Gambian number at all? */
  isGambian: boolean;
  /** Operator, when the range table could identify one. */
  operator: Operator;
  /** What we decided, and why. */
  reason: MigrationReason;
  /** The 7 subscriber digits, whenever we could isolate them. */
  legacyDigits: string | null;
  /** The 9-digit national number, when applicable. */
  national9: string | null;
  /** Strict E.164, e.g. `+220877123456`. */
  e164: string | null;
  /** How the original was written. */
  style: CountryStyle;
  /**
   * The exact string to write into the contact, in the same country-code style
   * as the original (`+220 877123456`, `00220 877123456`, `877123456`, ...).
   * Null when nothing should be written.
   */
  write: string | null;
  /** Human-friendly grouping for the UI, e.g. `877 123 456`. */
  pretty: string | null;
  /** True only when it is safe and correct to rewrite this number. */
  needsMigration: boolean;
  /**
   * The number sits in a block that used to hold Gamtel fixed lines (42x-49x,
   * 55x-57x, 8xx). It still migrates, but the UI marks it for a second look.
   */
  mayBeFixedLine: boolean;
}

export const OPERATOR_PREFIXES: Record<MigratingOperator, string> = {
  Africell: '87',
  QCell: '83',
  Comium: '86',
};

export const MIGRATING_OPERATORS: MigratingOperator[] = ['Africell', 'QCell', 'Comium'];

export const OPERATOR_DISPLAY: Record<Operator, string> = {
  Africell: 'Africell',
  QCell: 'QCell',
  Comium: 'Comium',
  Gamtel: 'Gamtel',
  Gamcel: 'Gamcel',
  Unknown: 'Unknown',
};

/**
 * Leading digit -> operator, per PURA's migration notice. First match wins.
 *
 * 0 and 1 match nothing: those are the international access code and the short
 * code range, never a subscriber number.
 */
const LEGACY_RANGES: { pattern: RegExp; operator: Operator }[] = [
  { pattern: /^[247]/, operator: 'Africell' },
  { pattern: /^[35]/, operator: 'QCell' },
  { pattern: /^[68]/, operator: 'Comium' },
  { pattern: /^9/, operator: 'Gamcel' },
];

/**
 * Blocks that historically carried Gamtel fixed lines. These still migrate, but
 * are flagged so the user can eyeball them. See the note at the top of the file.
 */
const POSSIBLE_FIXED_LINE = [/^4[2-9]/, /^5[4-7]/, /^8/];

const PREFIX_TO_OPERATOR: Record<string, MigratingOperator> = {
  '87': 'Africell',
  '83': 'QCell',
  '86': 'Comium',
};

/** True for the blocks that historically carried Gamtel fixed lines. */
export function mayBeFixedLine(digits: string): boolean {
  return /^\d{7}$/.test(digits) && POSSIBLE_FIXED_LINE.some(p => p.test(digits));
}

export function isMigratingOperator(op: Operator): op is MigratingOperator {
  return op === 'Africell' || op === 'QCell' || op === 'Comium';
}

/** Operator that owns a 7-digit subscriber number, or `Unknown`. */
export function operatorForLegacyDigits(digits: string): Operator {
  if (!/^\d{7}$/.test(digits)) return 'Unknown';
  return LEGACY_RANGES.find(r => r.pattern.test(digits))?.operator ?? 'Unknown';
}

/** Keep only digits, and only a single leading `+`. */
function normalizeInput(raw: string): string {
  const digitsAndPlus = raw.replace(/[^\d+]/g, '');
  const hasLeadingPlus = digitsAndPlus.startsWith('+');
  const digits = digitsAndPlus.replace(/\+/g, '');
  return hasLeadingPlus ? `+${digits}` : digits;
}

interface ParsedNumber {
  isGambian: boolean;
  style: CountryStyle;
  /** Digits after the country code, trunk zeros removed. */
  national: string;
  /** True when the input contained no digits at all. */
  empty: boolean;
  /**
   * True when the number carried an explicit international prefix (`+` or `00`)
   * for a country that is not The Gambia. Only then can we honestly call a
   * number "foreign"; without a country code we merely cannot place it.
   */
  explicitlyForeign: boolean;
}

function stripTrunkZeros(s: string): string {
  return s.replace(/^0+/, '');
}

function parse(raw: string): ParsedNumber {
  const cleaned = normalizeInput(raw);
  const bare = cleaned.replace(/^\+/, '');

  const base = { empty: false, explicitlyForeign: false };

  if (bare.length === 0) {
    return { isGambian: false, style: 'national', national: '', empty: true, explicitlyForeign: false };
  }

  if (cleaned.startsWith('+220')) {
    return { ...base, isGambian: true, style: '+220', national: stripTrunkZeros(cleaned.slice(4)) };
  }

  if (cleaned.startsWith('+')) {
    // An explicit country code that is not ours.
    return { ...base, isGambian: false, style: 'national', national: bare, explicitlyForeign: true };
  }

  if (bare.startsWith('00220')) {
    return { ...base, isGambian: true, style: '00220', national: stripTrunkZeros(bare.slice(5)) };
  }

  if (bare.startsWith('00')) {
    return { ...base, isGambian: false, style: 'national', national: bare, explicitlyForeign: true };
  }

  // `220...` with no plus. Only treat it as our country code when what follows
  // is exactly a 7- or 9-digit national number, otherwise `2201234` (a genuine
  // Africell number in the 220 range) would be mangled.
  if (bare.startsWith('220')) {
    const rest = stripTrunkZeros(bare.slice(3));
    if (rest.length === 7 || rest.length === 9) {
      return { ...base, isGambian: true, style: '220', national: rest };
    }
  }

  const national = stripTrunkZeros(bare);
  if (national.length === 7 || national.length === 9) {
    // Locally, numbers are written with no country code at all.
    return { ...base, isGambian: true, style: 'national', national };
  }

  return { ...base, isGambian: false, style: 'national', national: bare };
}

/** `877123456` -> `877 123 456`; `7123456` -> `712 3456`. */
export function prettyPrint(digits: string): string {
  if (/^\d{9}$/.test(digits)) return digits.replace(/(\d{3})(\d{3})(\d{3})/, '$1 $2 $3');
  if (/^\d{7}$/.test(digits)) return digits.replace(/(\d{3})(\d{4})/, '$1 $2');
  return digits;
}

/** Re-attach the country code exactly the way the original had it. */
function applyStyle(style: CountryStyle, national: string): string {
  switch (style) {
    case '+220':
      return `+220 ${national}`;
    case '00220':
      return `00220 ${national}`;
    case '220':
      return `220${national}`;
    default:
      return national;
  }
}

function blank(original: string, style: CountryStyle = 'national'): NumberAnalysis {
  return {
    original,
    isGambian: false,
    operator: 'Unknown',
    reason: 'invalid',
    legacyDigits: null,
    national9: null,
    e164: null,
    style,
    write: null,
    pretty: null,
    needsMigration: false,
    mayBeFixedLine: false,
  };
}

/**
 * Decide what should happen to a single stored phone number.
 *
 * Every branch is deliberately conservative: `needsMigration` is true only for
 * a 7-digit number that falls squarely inside a published range belonging to
 * Africell, QCell or Comium. Anything we are unsure about is reported but never
 * rewritten.
 */
export function analyzeGambianNumber(raw: string): NumberAnalysis {
  if (!raw || !raw.trim()) return blank(raw ?? '');

  const parsed = parse(raw);
  const result = blank(raw, parsed.style);

  if (parsed.empty) return result;

  if (!parsed.isGambian) {
    if (!/^\d{6,15}$/.test(parsed.national)) {
      result.reason = 'invalid';
    } else {
      // A country code we recognise as not ours makes this genuinely foreign.
      // Without one, all we can say is that it matches no Gambian range.
      result.reason = parsed.explicitlyForeign ? 'foreign' : 'unknown-range';
    }
    return result;
  }

  result.isGambian = true;
  const national = parsed.national;

  // --- Already 9 digits -------------------------------------------------
  if (national.length === 9) {
    const prefix = national.slice(0, 2);
    const body = national.slice(2);
    const prefixOperator = PREFIX_TO_OPERATOR[prefix];

    if (!prefixOperator) {
      // 9 digits, but not one of the three migration prefixes. Most likely a
      // foreign number saved without its country code. Either way it is not a
      // number we can place, and definitely not one we may rewrite.
      result.reason = 'unknown-range';
      result.isGambian = parsed.style !== 'national';
      return result;
    }

    result.operator = prefixOperator;
    result.legacyDigits = body;
    result.national9 = national;
    result.e164 = `+220${national}`;
    result.pretty = prettyPrint(national);
    result.mayBeFixedLine = mayBeFixedLine(body);

    // Sanity check: does the subscriber number really belong to that operator?
    const bodyOperator = operatorForLegacyDigits(body);
    result.reason =
      bodyOperator === prefixOperator || bodyOperator === 'Unknown'
        ? 'already-migrated'
        : 'prefix-mismatch';
    return result;
  }

  // --- Legacy 7 digits --------------------------------------------------
  if (national.length === 7) {
    const operator = operatorForLegacyDigits(national);
    result.legacyDigits = national;
    result.operator = operator;

    if (operator === 'Unknown') {
      // 0X / 1X - access codes and short codes, not subscriber numbers.
      result.reason = 'unknown-range';
      return result;
    }

    if (!isMigratingOperator(operator)) {
      result.reason = 'not-migrating';
      result.pretty = prettyPrint(national);
      return result;
    }

    const national9 = OPERATOR_PREFIXES[operator] + national;
    result.reason = 'needs-migration';
    result.national9 = national9;
    result.e164 = `+220${national9}`;
    result.write = applyStyle(parsed.style, national9);
    result.pretty = prettyPrint(national9);
    result.needsMigration = true;
    result.mayBeFixedLine = mayBeFixedLine(national);
    return result;
  }

  // 8 digits, 10+ digits, anything else: report, never touch.
  result.reason = 'unknown-range';
  return result;
}

/**
 * Force a specific operator onto a 7-digit number.
 *
 * Used by the "I know which network this is" escape hatch in the UI, so a
 * number we could not classify (or classified as belonging to a fixed line)
 * can still be migrated on the user's explicit instruction.
 */
export function migrateWithOperator(raw: string, operator: MigratingOperator): NumberAnalysis {
  const parsed = parse(raw);
  const result = blank(raw, parsed.style);
  if (!parsed.isGambian || parsed.national.length !== 7) return result;

  const national9 = OPERATOR_PREFIXES[operator] + parsed.national;
  return {
    ...result,
    isGambian: true,
    operator,
    reason: 'needs-migration',
    legacyDigits: parsed.national,
    national9,
    e164: `+220${national9}`,
    write: applyStyle(parsed.style, national9),
    pretty: prettyPrint(national9),
    needsMigration: true,
    mayBeFixedLine: mayBeFixedLine(parsed.national),
  };
}

/**
 * True when the user could sensibly pick an operator for this number by hand.
 *
 * Only 7-digit Gambian numbers qualify: those are the ones where all that is
 * missing is the two-digit prefix. A 9-digit number already has a prefix, and a
 * foreign or malformed number has no prefix to add.
 */
export function canChooseOperator(raw: string): boolean {
  const parsed = parse(raw);
  return parsed.isGambian && parsed.national.length === 7;
}

/**
 * Reduce a number to its comparable digits so that two spellings of the same
 * number match: `+220 877 123 456`, `00220877123456` and `877123456` all
 * collapse to `877123456`.
 *
 * Used when writing to and restoring from the address book, where the user may
 * have reformatted the number in the meantime.
 */
export function numberKey(raw: string): string {
  const parsed = parse(raw);
  if (parsed.isGambian) return parsed.national;
  return normalizeInput(raw).replace(/^\+/, '');
}

/** True when two stored numbers refer to the same subscriber. */
export function isSameNumber(a: string, b: string): boolean {
  const ka = numberKey(a);
  const kb = numberKey(b);
  if (!ka || !kb) return false;
  if (ka === kb) return true;
  // A 7-digit legacy number and its 9-digit form are the same subscriber.
  if (ka.length === 9 && kb.length === 7) return ka.endsWith(kb) && !!PREFIX_TO_OPERATOR[ka.slice(0, 2)];
  if (kb.length === 9 && ka.length === 7) return kb.endsWith(ka) && !!PREFIX_TO_OPERATOR[kb.slice(0, 2)];
  return false;
}

/** One-line human explanation of a verdict, for the UI. */
export function explainReason(a: NumberAnalysis): string {
  switch (a.reason) {
    case 'needs-migration':
      return `${OPERATOR_DISPLAY[a.operator]} number - add the ${OPERATOR_PREFIXES[a.operator as MigratingOperator]} prefix`;
    case 'already-migrated':
      return `Already in the new 9-digit ${OPERATOR_DISPLAY[a.operator]} format`;
    case 'not-migrating':
      // Only Gamcel reaches this now. Gamtel keeps the branch honest in case a
      // future notice adds fixed lines to the migration.
      return a.operator === 'Gamtel'
        ? 'Gamtel fixed line - not part of this migration'
        : 'Gamcel number - not part of this migration';
    case 'prefix-mismatch':
      return 'The 9-digit prefix does not match this subscriber number';
    case 'unknown-range':
      return 'Not in any published Gambian number range';
    case 'foreign':
      return 'Not a Gambian number';
    default:
      return 'Not a recognisable phone number';
  }
}

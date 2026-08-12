/**
 * The migration calendar, in one place.
 *
 * These dates were previously written out both as `new Date(...)` values and as
 * English strings in several screens, so a correction had to be made in five
 * places. Everything derives from here now.
 */

/** Midnight on Friday 4 September 2026: 9-digit numbers go live. */
export const MIGRATION_START = new Date(2026, 8, 4, 0, 0, 0);

/**
 * Midnight at the start of 1 December 2026: the moment 7-digit numbers stop
 * working. The dual-numbering period covers 4 Sep - 30 Nov inclusive.
 */
export const CUTOFF = new Date(2026, 11, 1, 0, 0, 0);

export const MIGRATION_START_LABEL = '4 September 2026';
/** Compact form, for pills and tight rows. */
export const MIGRATION_START_SHORT = '4 Sep';
export const DUAL_PERIOD_LABEL = '4 Sep – 30 Nov 2026';
export const CUTOFF_LABEL = '30 November 2026';

export type MigrationPhase = 'before' | 'dual' | 'after';

const DAY_MS = 86_400_000;

export interface PhaseInfo {
  phase: MigrationPhase;
  /** Whole days until the next milestone, floored at 0. */
  daysUntilStart: number;
  daysUntilCutoff: number;
}

export function phaseAt(now: number): PhaseInfo {
  const daysUntilStart = Math.max(0, Math.ceil((MIGRATION_START.getTime() - now) / DAY_MS));
  const daysUntilCutoff = Math.max(0, Math.ceil((CUTOFF.getTime() - now) / DAY_MS));

  const phase: MigrationPhase =
    now < MIGRATION_START.getTime() ? 'before' : now < CUTOFF.getTime() ? 'dual' : 'after';

  return { phase, daysUntilStart, daysUntilCutoff };
}

/** `1 day` / `12 days`, so the UI never says "1 days". */
export function pluralDays(n: number): string {
  return `${n} ${n === 1 ? 'day' : 'days'}`;
}

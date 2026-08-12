import {
  CUTOFF_LABEL,
  MIGRATION_START_SHORT,
  phaseAt,
  pluralDays,
  type MigrationPhase,
} from '@/constants/timeline';
import { useNow } from '@/hooks/use-now';

export interface MigrationStatus {
  phase: MigrationPhase;
  /** Two or three words for the masthead pill. A countdown wherever possible. */
  pill: string;
  /** One short line. Not a paragraph. */
  note: string;
  /** True once old numbers stop working - the only genuinely urgent state. */
  urgent: boolean;
}

/**
 * The only thing the home screen says about timing.
 *
 * This used to be a three-paragraph banner with a kicker, a headline and a body.
 * A day count and one line is all that survives; the dates, the reasoning and
 * the full timeline live in the Guide tab.
 */
export function useMigrationStatus(): MigrationStatus {
  const { phase, daysUntilStart, daysUntilCutoff } = phaseAt(useNow());

  if (phase === 'before') {
    return {
      phase,
      pill: pluralDays(daysUntilStart),
      note: `New numbers go live ${MIGRATION_START_SHORT}. Same SIM, same line.`,
      urgent: false,
    };
  }

  if (phase === 'dual') {
    return {
      phase,
      pill: `${pluralDays(daysUntilCutoff)} left`,
      note: `Both formats work until ${CUTOFF_LABEL}.`,
      urgent: false,
    };
  }

  return {
    phase,
    pill: '9 digits only',
    note: '7-digit numbers no longer connect.',
    urgent: true,
  };
}

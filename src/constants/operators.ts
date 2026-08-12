import type { Operator } from '@/utils/migration';

/**
 * One source of truth for how each operator looks. The colours used to be
 * duplicated as Tailwind classes in one screen and hex strings in another, so
 * the same operator could render in two different colours.
 */
export interface OperatorStyle {
  label: string;
  /** Tailwind background class, for dots and badges. */
  bg: string;
  /** Tailwind text class. */
  fg: string;
  /** Raw hex, for anything that needs a style prop. */
  hex: string;
}

export const OPERATOR_UI: Record<Operator, OperatorStyle> = {
  Africell: { label: 'Africell', bg: 'bg-operator-africell', fg: 'text-operator-africell', hex: '#E8544F' },
  QCell: { label: 'QCell', bg: 'bg-operator-qcell', fg: 'text-operator-qcell', hex: '#E3A83C' },
  Comium: { label: 'Comium', bg: 'bg-operator-comium', fg: 'text-operator-comium', hex: '#4C8DF6' },
  Gamtel: { label: 'Gamtel', bg: 'bg-operator-gamtel', fg: 'text-operator-gamtel', hex: '#7A828F' },
  Gamcel: { label: 'Gamcel', bg: 'bg-operator-gamcel', fg: 'text-operator-gamcel', hex: '#3FAE7E' },
  Unknown: { label: 'Unknown', bg: 'bg-operator-gamtel', fg: 'text-operator-gamtel', hex: '#7A828F' },
};

export function operatorStyle(operator: Operator | string): OperatorStyle {
  return OPERATOR_UI[operator as Operator] ?? OPERATOR_UI.Unknown;
}

/** The Gambian flag, as Tailwind background classes. */
export const FLAG_STRIPES = [
  'bg-brand-red',
  'bg-white',
  'bg-brand-blue',
  'bg-white',
  'bg-brand-green',
];

/** Brand blue, for anything needing a raw colour value. */
export const BLUE = '#2563EB';

/** `#2563EB` + 0.12 -> `rgba(37,99,235,0.12)`, for tinted gradients. */
export function withAlpha(hex: string, alpha: number): string {
  const value = hex.replace('#', '');
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Example numbers for the home-screen demo, one per migrating operator.
 *
 * Each is a real range for that operator (see LEGACY_RANGES in utils/migration),
 * so the hero animation is never showing a number the app itself would classify
 * differently.
 */
export const OPERATOR_DEMO = [
  { operator: 'Africell', legacy: '7123456' },
  { operator: 'QCell', legacy: '3312345' },
  { operator: 'Comium', legacy: '6612345' },
] as const;

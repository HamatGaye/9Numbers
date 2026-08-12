/**
 * The design system.
 *
 * Two rules keep the app coherent:
 *  1. Screens compose these pieces and add no colours of their own. Every
 *     light/dark pairing is written once, here.
 *  2. Text is a design element, not a place to explain. Components take short
 *     labels; long-form explanation belongs in the Guide tab or a Sheet.
 *
 * Typography is deliberately mixed: a serif `Display` for headlines (the
 * "classic" half), a sans UI for controls, and mono for phone numbers so digits
 * line up and a changed prefix is easy to spot.
 */

import type { ReactNode } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
  type TextProps,
  type ViewProps,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FLAG_STRIPES, operatorStyle } from '@/constants/operators';
import type { Operator } from '@/utils/migration';

/* ------------------------------------------------------------------ surfaces */

export function Screen({
  children,
  center,
  className = '',
}: {
  children: ReactNode;
  center?: boolean;
  className?: string;
}) {
  return (
    <SafeAreaView
      className={`flex-1 bg-paper dark:bg-night ${center ? 'items-center justify-center' : ''} ${className}`}>
      {children}
    </SafeAreaView>
  );
}

export function Card({
  children,
  className = '',
  ...rest
}: ViewProps & { children: ReactNode; className?: string }) {
  return (
    <View
      className={`bg-paper-raised dark:bg-night-raised border border-paper-line dark:border-night-line rounded-3xl ${className}`}
      {...rest}>
      {children}
    </View>
  );
}

/** A recessed well, for content sitting inside a Card. */
export function Well({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <View className={`bg-paper-sunken dark:bg-night-sunken rounded-2xl ${className}`}>
      {children}
    </View>
  );
}

export function Divider({ className = '' }: { className?: string }) {
  return <View className={`h-px bg-paper-line dark:bg-night-line ${className}`} />;
}

/* ---------------------------------------------------------------- typography */

/**
 * All text styles take the full set of `Text` props, so a caller can add
 * `numberOfLines` or accessibility attributes without reaching for a raw `Text`
 * and losing the palette.
 */
type TextStyleProps = TextProps & { children: ReactNode; className?: string };

function textStyle(base: string) {
  return function Styled({ children, className = '', ...rest }: TextStyleProps) {
    return (
      <Text className={`${base} ${className}`} {...rest}>
        {children}
      </Text>
    );
  };
}

export const Display = textStyle('font-display text-ink dark:text-chalk text-[32px] leading-9');
export const Title = textStyle('font-display text-ink dark:text-chalk text-2xl');
export const Label = textStyle('text-ink dark:text-chalk text-sm font-semibold');
export const Muted = textStyle('text-ink-soft dark:text-chalk-soft text-sm leading-5');
export const Micro = textStyle('text-ink-soft dark:text-chalk-soft text-[11px]');

/** All-caps tracking-wide kicker. One or two words only. */
export const Eyebrow = textStyle(
  'text-ink-soft dark:text-chalk-soft text-[10px] font-bold uppercase tracking-[2px]'
);

/* ------------------------------------------------------------------- actions */

type ButtonTone = 'primary' | 'quiet' | 'ghost' | 'danger';

const TONES: Record<ButtonTone, { box: string; text: string }> = {
  primary: { box: 'bg-gold active:bg-gold-deep', text: 'text-gold-ink' },
  quiet: {
    box: 'bg-paper-sunken dark:bg-night-sunken border border-paper-line dark:border-night-line active:opacity-70',
    text: 'text-ink dark:text-chalk',
  },
  ghost: { box: 'active:opacity-50', text: 'text-ink-soft dark:text-chalk-soft' },
  danger: { box: 'active:opacity-60', text: 'text-bad' },
};

export function Button({
  label,
  onPress,
  tone = 'primary',
  disabled,
  className = '',
}: {
  label: string;
  onPress: () => void;
  tone?: ButtonTone;
  disabled?: boolean;
  className?: string;
}) {
  const style = TONES[tone];
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      className={`py-4 px-5 rounded-2xl ${
        disabled ? 'bg-paper-sunken dark:bg-night-sunken' : style.box
      } ${className}`}>
      <Text
        className={`text-center text-[15px] font-bold ${
          disabled ? 'text-ink-soft dark:text-chalk-soft' : style.text
        }`}>
        {label}
      </Text>
    </Pressable>
  );
}

/** A small round icon button, for back arrows and close buttons. */
export function IconButton({
  glyph,
  onPress,
  label,
  className = '',
}: {
  glyph: string;
  onPress: () => void;
  label: string;
  className?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={label}
      className={`w-9 h-9 rounded-full items-center justify-center bg-paper-sunken dark:bg-night-sunken active:opacity-60 ${className}`}>
      <Text className="text-ink dark:text-chalk text-base">{glyph}</Text>
    </Pressable>
  );
}

export function Pill({
  label,
  tone = 'neutral',
  dot,
  onPress,
  active,
}: {
  label: string;
  tone?: 'neutral' | 'gold' | 'good' | 'warn';
  dot?: string;
  onPress?: () => void;
  active?: boolean;
}) {
  const tones = {
    neutral: 'bg-paper-sunken dark:bg-night-sunken',
    gold: 'bg-gold/15',
    good: 'bg-good/15',
    warn: 'bg-warn/15',
  };
  const text = {
    neutral: 'text-ink-soft dark:text-chalk-soft',
    gold: 'text-gold-deep dark:text-gold',
    good: 'text-good',
    warn: 'text-warn',
  };

  const body = (
    <View
      className={`flex-row items-center rounded-full px-3 py-1.5 ${
        active ? 'bg-gold' : tones[tone]
      }`}>
      {dot ? <View className={`w-1.5 h-1.5 rounded-full mr-2 ${dot}`} /> : null}
      <Text
        className={`text-[11px] font-bold ${active ? 'text-gold-ink' : text[tone]}`}>
        {label}
      </Text>
    </View>
  );

  if (!onPress) return body;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: !!active }}>
      {body}
    </Pressable>
  );
}

export function Check({
  checked,
  mixed,
  onPress,
  label,
}: {
  checked: boolean;
  mixed?: boolean;
  onPress: () => void;
  label: string;
}) {
  const on = checked || mixed;
  return (
    <Pressable
      onPress={onPress}
      hitSlop={10}
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked: mixed ? 'mixed' : checked }}
      className="active:opacity-60">
      <View
        className={`w-[22px] h-[22px] rounded-lg items-center justify-center border ${
          on
            ? 'bg-gold border-gold'
            : 'border-paper-line dark:border-night-line bg-paper-sunken dark:bg-night-sunken'
        }`}>
        {mixed ? (
          <View className="w-2.5 h-[2px] bg-gold-ink rounded-full" />
        ) : checked ? (
          <Text className="text-gold-ink text-[11px] font-bold">✓</Text>
        ) : null}
      </View>
    </Pressable>
  );
}

/* -------------------------------------------------------------------- pieces */

/** The Gambian flag, reduced to a hairline motif. */
export function Flag({ className = 'h-1 w-14' }: { className?: string }) {
  return (
    <View className={`rounded-full overflow-hidden flex-row ${className}`}>
      {FLAG_STRIPES.map((stripe, i) => (
        <View key={i} className={`${stripe} flex-1`} />
      ))}
    </View>
  );
}

export function Stat({ value, label }: { value: string | number; label: string }) {
  return (
    <View className="flex-1 items-center">
      <Text className="font-display text-ink dark:text-chalk text-[26px]">{value}</Text>
      <Micro className="mt-0.5 text-center">{label}</Micro>
    </View>
  );
}

export function OperatorTag({ operator }: { operator: Operator }) {
  const style = operatorStyle(operator);
  return (
    <View className="flex-row items-center">
      <View className={`w-1.5 h-1.5 rounded-full mr-1.5 ${style.bg}`} />
      <Text className="text-ink-soft dark:text-chalk-soft text-[10px] font-bold uppercase tracking-wider">
        {style.label}
      </Text>
    </View>
  );
}

/**
 * The signature element: the old number struck through, the new one with its
 * added prefix in gold. Mono so the digits align down a list.
 */
export function NumberDiff({
  before,
  prefix,
  rest,
  size = 'sm',
}: {
  before: string;
  prefix: string;
  rest: string;
  size?: 'sm' | 'lg';
}) {
  const scale = size === 'lg' ? 'text-2xl' : 'text-[13px]';
  return (
    <View className="flex-row items-baseline flex-wrap">
      <Text className={`font-mono text-ink-soft/60 dark:text-chalk-soft/60 line-through ${scale}`}>
        {before}
      </Text>
      <Text className="text-ink-soft dark:text-chalk-soft text-[10px] mx-2">→</Text>
      <Text className={`font-mono font-bold text-gold-deep dark:text-gold ${scale}`}>{prefix}</Text>
      <Text className={`font-mono font-bold text-ink dark:text-chalk ${scale}`}>{rest}</Text>
    </View>
  );
}

/* -------------------------------------------------------------------- sheets */

/**
 * A bottom sheet. Anything that would otherwise become a paragraph on a main
 * screen goes in one of these: the number checker, the list of numbers we could
 * not place, and the confirm step before writing.
 */
export function Sheet({
  visible,
  onClose,
  title,
  children,
  footer,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-black/50">
        {/* Tapping the dimmed area dismisses, the standard sheet gesture. */}
        <Pressable
          className="flex-1"
          accessibilityRole="button"
          accessibilityLabel="Close"
          onPress={onClose}
        />
        <View className="bg-paper dark:bg-night rounded-t-[32px] max-h-[85%] overflow-hidden">
          <View className="items-center pt-3 pb-1">
            <View className="w-9 h-1 rounded-full bg-paper-line dark:bg-night-line" />
          </View>
          <View className="flex-row items-center justify-between px-5 pt-2 pb-3">
            <Title>{title}</Title>
            <IconButton glyph="✕" onPress={onClose} label="Close" />
          </View>
          <ScrollView
            className="px-5"
            contentContainerClassName="pb-4"
            keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
          {footer ? (
            <SafeAreaView edges={['bottom']} className="px-5 pt-3">
              {footer}
            </SafeAreaView>
          ) : (
            <SafeAreaView edges={['bottom']} />
          )}
        </View>
      </View>
    </Modal>
  );
}

/** Full-bleed row used for list items that are tappable. */
export function Row({
  children,
  onPress,
  className = '',
}: {
  children: ReactNode;
  onPress?: () => void;
  className?: string;
}) {
  if (!onPress) return <View className={`flex-row items-center ${className}`}>{children}</View>;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      className={`flex-row items-center active:opacity-60 ${className}`}>
      {children}
    </Pressable>
  );
}

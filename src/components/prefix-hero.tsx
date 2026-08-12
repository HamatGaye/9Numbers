import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInLeft } from 'react-native-reanimated';

import { Micro } from '@/components/ui';
import { OPERATOR_DEMO, operatorStyle, withAlpha } from '@/constants/operators';
import { analyzeGambianNumber, prettyPrint, type Operator } from '@/utils/migration';

const CYCLE_MS = 3200;

/**
 * The home screen's centrepiece, and the reason the copy could be deleted.
 *
 * It cycles through the three migrating operators, animating the two new digits
 * into place in front of a real example number. Someone who cannot read the app's
 * language still understands the change after watching it once — which is the
 * whole point, since this is a national change affecting everybody.
 *
 * The example numbers run through the real engine rather than being hardcoded
 * strings, so the demo can never disagree with what the app would actually do.
 */
export function PrefixHero() {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => setIndex(i => (i + 1) % OPERATOR_DEMO.length), CYCLE_MS);
    return () => clearInterval(id);
  }, [paused]);

  const demo = OPERATOR_DEMO[index];
  const analysis = analyzeGambianNumber(demo.legacy);
  const operator = analysis.operator as Operator;
  const style = operatorStyle(operator);
  const prefix = analysis.national9?.slice(0, 2) ?? '';
  const body = prettyPrint(analysis.national9 ?? '').slice(2);

  return (
    <View
      className="rounded-[28px] overflow-hidden border border-paper-line dark:border-night-line"
      style={{
        experimental_backgroundImage: `linear-gradient(150deg, ${withAlpha(
          style.hex,
          0.22
        )}, ${withAlpha(style.hex, 0.02)})`,
      }}>
      {/* Hairline of the operator colour along the top edge. */}
      <View className="h-[3px]" style={{ backgroundColor: style.hex }} />

      <View className="px-6 pt-5 pb-6">
        <View className="flex-row items-center justify-between">
          <Animated.View key={`tag-${operator}`} entering={FadeIn.duration(300)}>
            <View className="flex-row items-center">
              <View className="w-1.5 h-1.5 rounded-full mr-2" style={{ backgroundColor: style.hex }} />
              <Text className="text-ink dark:text-chalk text-[11px] font-bold uppercase tracking-[2px]">
                {style.label}
              </Text>
            </View>
          </Animated.View>

          {/* Carousel dots, tappable so the demo can be driven by hand. */}
          <View className="flex-row items-center gap-1.5">
            {OPERATOR_DEMO.map((item, i) => (
              <Pressable
                key={item.operator}
                onPress={() => {
                  setIndex(i);
                  setPaused(true);
                }}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={`Show ${item.operator} example`}
                accessibilityState={{ selected: i === index }}>
                <View
                  className={`h-1.5 rounded-full ${i === index ? 'w-5' : 'w-1.5'}`}
                  style={{
                    backgroundColor: i === index ? style.hex : withAlpha(style.hex, 0.3),
                  }}
                />
              </Pressable>
            ))}
          </View>
        </View>

        {/* Before */}
        <Animated.View key={`old-${operator}`} entering={FadeIn.duration(350)} className="mt-5">
          <Text className="font-mono text-ink-soft dark:text-chalk-soft text-base line-through">
            {prettyPrint(demo.legacy)}
          </Text>
        </Animated.View>

        {/* After - the prefix flies in from the left, so the eye sees it join. */}
        <View className="flex-row items-baseline mt-1.5">
          <Animated.View
            key={`prefix-${operator}`}
            entering={FadeInLeft.delay(180).duration(420)}>
            <Text
              className="font-mono text-[34px] font-bold tracking-tight"
              style={{ color: style.hex }}>
              {prefix}
            </Text>
          </Animated.View>
          <Animated.View key={`body-${operator}`} entering={FadeIn.duration(350)}>
            <Text className="font-mono text-ink dark:text-chalk text-[34px] font-bold tracking-tight">
              {body}
            </Text>
          </Animated.View>
        </View>

        <View className="h-px bg-paper-line dark:bg-night-line mt-5 mb-3" />

        <Animated.View key={`e164-${operator}`} entering={FadeIn.duration(350)}>
          <Micro className="font-mono">{analysis.e164}</Micro>
        </Animated.View>
      </View>
    </View>
  );
}

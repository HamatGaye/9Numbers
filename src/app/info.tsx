import { useState } from 'react';
import { Linking, Pressable, ScrollView, Text, View } from 'react-native';

import {
  Card,
  Divider,
  Eyebrow,
  Micro,
  Muted,
  NumberDiff,
  Row,
  Screen,
  Title,
  Well,
} from '@/components/ui';
import { OPERATOR_UI } from '@/constants/operators';
import { MIGRATION_START_LABEL, phaseAt } from '@/constants/timeline';
import { useNow } from '@/hooks/use-now';
import { OPERATOR_PREFIXES } from '@/utils/migration';

/**
 * Reference material. This is the one screen allowed to carry prose, which is
 * exactly why the other screens no longer need to.
 *
 * Every range shown here must match LEGACY_RANGES in `utils/migration.ts`, and
 * both trace back to the same authority: PURA's 7-to-9-digit migration notice.
 * If you change one, change the other.
 */

const MIGRATING = [
  { name: 'Africell' as const, ranges: '2x · 4x · 7x' },
  { name: 'QCell' as const, ranges: '3x · 5x' },
  { name: 'Comium' as const, ranges: '6x · 8x' },
];

const UNCHANGED = [{ name: 'Gamcel' as const, ranges: '9x', note: 'joins later' }];

const FAQ: { q: string; a: string }[] = [
  {
    q: 'What changes?',
    a: 'Only the front. Two digits are added: 87 Africell, 83 QCell, 86 Comium. 7123456 becomes 877123456.',
  },
  {
    q: 'New SIM or re-registration?',
    a: 'No. Your SIM, handset, airtime and bundles are unaffected, and the change is free.',
  },
  {
    q: 'Why now?',
    a: 'The 7-digit plan is nearly full. Nine digits raises capacity from about 10 million numbers to about 1 billion.',
  },
  {
    q: 'Gamcel numbers?',
    a: 'Not in this phase. Numbers starting with 9 are left exactly as they are.',
  },
  {
    q: 'Is anything uploaded?',
    a: 'No. No account, no server. Contacts are read and changed on this phone, and backups stay here.',
  },
  {
    q: 'Can I undo?',
    a: 'Yes, from the Backups tab. If a restore only partly succeeds, whatever could not be undone stays in the backup so you can retry.',
  },
  {
    q: 'What if a number is not recognised?',
    a: 'It is left alone and listed for you. For a 7-digit number you can pick the network yourself and the prefix is added.',
  },
  {
    q: 'Why is one of my numbers marked "check"?',
    a: 'Gamtel landlines used to sit inside the 4, 55–57 and 8 blocks that now belong to migrating operators. Those numbers are still updated, but flagged so you can untick anything you know is a landline.',
  },
];

export default function InfoScreen() {
  const [open, setOpen] = useState<number | null>(null);
  const { phase } = phaseAt(useNow());

  const timeline = [
    { when: MIGRATION_START_LABEL, what: 'New numbers go live', done: phase !== 'before' },
    { when: 'Until 30 Nov', what: 'Both formats work', current: phase === 'dual' },
    { when: 'From 1 Dec', what: 'Old numbers stop', current: phase === 'after' },
  ];

  return (
    <Screen>
      <ScrollView className="flex-1" contentContainerClassName="px-6 pt-4 pb-10">
        <Title>The change</Title>

        {/* The whole thing, as one picture */}
        <Well className="mt-5 p-6 items-center">
          <NumberDiff size="lg" before="712 3456" prefix="87" rest="7 123 456" />
          <Micro className="mt-3 font-mono">+220 877123456</Micro>
        </Well>

        {/* Prefixes */}
        <Eyebrow className="mt-8 mb-3">Gaining a prefix</Eyebrow>
        <Card className="px-5 py-1">
          {MIGRATING.map((op, i) => (
            <View key={op.name}>
              {i > 0 && <Divider />}
              <Row className="py-3.5">
                <View className={`w-1.5 h-1.5 rounded-full mr-3 ${OPERATOR_UI[op.name].bg}`} />
                <View className="flex-1">
                  <Text className="text-ink dark:text-chalk text-[15px]">{op.name}</Text>
                  <Micro className="font-mono mt-0.5">{op.ranges}</Micro>
                </View>
                <Text className="font-mono text-gold-deep dark:text-gold text-lg font-bold">
                  {OPERATOR_PREFIXES[op.name]}
                </Text>
              </Row>
            </View>
          ))}
        </Card>

        <Eyebrow className="mt-6 mb-3">Not in this phase</Eyebrow>
        <Card className="px-5 py-1">
          {UNCHANGED.map((op, i) => (
            <View key={op.name}>
              {i > 0 && <Divider />}
              <Row className="py-3.5">
                <View className={`w-1.5 h-1.5 rounded-full mr-3 ${OPERATOR_UI[op.name].bg}`} />
                <View className="flex-1">
                  <Text className="text-ink dark:text-chalk text-[15px]">{op.name}</Text>
                  <Micro className="font-mono mt-0.5">{op.ranges}</Micro>
                </View>
                <Micro>{op.note}</Micro>
              </Row>
            </View>
          ))}
        </Card>

        {/* Timeline */}
        <Eyebrow className="mt-8 mb-3">When</Eyebrow>
        <Card className="px-5 py-1">
          {timeline.map((item, i) => (
            <View key={item.what}>
              {i > 0 && <Divider />}
              <Row className="py-3.5">
                <View
                  className={`w-1.5 h-1.5 rounded-full mr-3 ${
                    item.current ? 'bg-gold' : item.done ? 'bg-good' : 'bg-operator-gamtel'
                  }`}
                />
                <Text className="flex-1 text-ink dark:text-chalk text-[15px]">{item.what}</Text>
                <Micro>{item.when}</Micro>
              </Row>
            </View>
          ))}
        </Card>

        {/* FAQ */}
        <Eyebrow className="mt-8 mb-3">Questions</Eyebrow>
        <Card className="px-5 py-1">
          {FAQ.map((item, i) => {
            const expanded = open === i;
            return (
              <View key={item.q}>
                {i > 0 && <Divider />}
                <Pressable
                  onPress={() => setOpen(expanded ? null : i)}
                  accessibilityRole="button"
                  accessibilityState={{ expanded }}
                  className="py-4 flex-row items-center active:opacity-60">
                  <Text className="flex-1 text-ink dark:text-chalk text-[15px] pr-3">{item.q}</Text>
                  <Text className="text-ink-soft dark:text-chalk-soft text-base">
                    {expanded ? '−' : '+'}
                  </Text>
                </Pressable>
                {expanded && <Muted className="pb-4">{item.a}</Muted>}
              </View>
            );
          })}
        </Card>

        {/* Official help */}
        <Pressable
          onPress={() => Linking.openURL('tel:148')}
          accessibilityRole="button"
          className="mt-6 active:opacity-70">
          <Card className="px-5 py-4 flex-row items-center">
            <View className="flex-1">
              <Text className="text-ink dark:text-chalk text-[15px] font-semibold">
                PURA helpdesk
              </Text>
              <Micro className="mt-0.5">Free from any network</Micro>
            </View>
            <Text className="font-mono text-gold-deep dark:text-gold text-xl font-bold">148</Text>
          </Card>
        </Pressable>

        <Micro className="mt-6 text-center leading-4">
          Ranges follow PURA&apos;s 7-to-9-digit migration notice.{'\n'}
          Independent app — verify at pura.gm
        </Micro>
      </ScrollView>
    </Screen>
  );
}

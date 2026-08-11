import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const FLAG_STRIPES = ['bg-brand-red', 'bg-white', 'bg-brand-blue', 'bg-white', 'bg-brand-green'];

interface TimelineItem {
  date: string;
  title: string;
  body: string;
  active?: boolean;
}

const TIMELINE: TimelineItem[] = [
  {
    date: '4 Sep 2026',
    title: 'Migration starts',
    body: 'New 9-digit numbers are activated. Both 7-digit and 9-digit formats work for calls and SMS.',
    active: true,
  },
  {
    date: '4 Sep – 30 Nov 2026',
    title: 'Dual-numbering period',
    body: 'The transition window. Calls and SMS complete in either format. Best time to update your contacts.',
    active: true,
  },
  {
    date: '1 Dec 2026',
    title: 'Hard cut-off',
    body: 'Only 9-digit numbers work. Old 7-digit numbers no longer complete calls or SMS.',
  },
];

const OPERATORS = [
  { name: 'Africell', prefix: '87', examples: ['877xxxxxx', '872xxxxxx', '874xxxxxx'], color: 'bg-operator-africell' },
  { name: 'QCell', prefix: '83', examples: ['833xxxxxx', '835xxxxxx'], color: 'bg-operator-qcell' },
  { name: 'Comium', prefix: '86', examples: ['866xxxxxx', '868xxxxxx'], color: 'bg-operator-comium' },
];

const FAQ = [
  {
    q: 'Why is this happening?',
    a: 'The current 7-digit plan holds about 10 million numbers and is nearly full. The 9-digit plan expands capacity to roughly 1 billion numbers and aligns with ITU recommendations.',
  },
  {
    q: 'Do I need a new SIM or to re-register?',
    a: 'No. No SIM change, no handset change, no re-registration. Airtime, data bundles and registered SIM details stay the same. The change is free.',
  },
  {
    q: 'What about Gamtel and Gamcel numbers?',
    a: 'Gamtel (fixed) and Gamcel (mobile) are not part of the initial migration and will join later when ready. 9Numbers leaves those numbers unchanged.',
  },
  {
    q: 'Is my data uploaded anywhere?',
    a: 'No. Everything happens on your device. Your contacts are read locally, updated locally, and backups are stored locally. There is no account and no server.',
  },
  {
    q: 'Can I undo the update?',
    a: 'Yes. Every migration run is backed up locally. Open the Backups tab and restore any run to put your 7-digit numbers back.',
  },
  {
    q: 'What happens after 30 November 2026?',
    a: '7-digit numbers stop working entirely. If any of your contacts are still in the old format after the cut-off, you can still use 9Numbers to fix them.',
  },
];

function Flag() {
  return (
    <View className="h-2 w-20 rounded-full overflow-hidden flex-row">
      {FLAG_STRIPES.map((stripe, i) => (
        <View key={i} className={`${stripe} flex-1`} />
      ))}
    </View>
  );
}

export default function InfoScreen() {
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  return (
    <SafeAreaView className="flex-1 bg-brand-cream dark:bg-slate-950">
      <ScrollView className="flex-1" contentContainerClassName="p-4 pb-10">
        <View className="flex-row items-center mb-4">
          <Flag />
          <Text className="text-brand-ink dark:text-white text-2xl font-extrabold ml-3">
            Migration guide
          </Text>
        </View>

        <View className="bg-white dark:bg-slate-900 rounded-2xl p-5 mb-4 shadow-sm">
          <Text className="text-brand-ink dark:text-white text-lg font-bold mb-1">
            The change in one line
          </Text>
          <Text className="text-slate-600 dark:text-slate-400 text-sm leading-5">
            Your existing 7-digit number stays the same — a two-digit operator prefix is simply
            added in front. Led by{' '}
            <Text className="text-brand-ink dark:text-white font-semibold">PURA</Text>.
          </Text>
          <View className="mt-4 bg-brand-cream dark:bg-slate-800 rounded-xl p-3">
            <Text className="text-slate-500 dark:text-slate-400 text-xs mb-1">Example</Text>
            <View className="flex-row items-center">
              <Text className="text-slate-500 dark:text-slate-400 font-mono line-through mr-2">
                7123456
              </Text>
              <Text className="text-slate-400 font-mono text-xs mr-2">→</Text>
              <Text className="text-brand-red font-mono font-bold">877123456</Text>
            </View>
            <Text className="text-slate-400 dark:text-slate-500 text-[11px] mt-1">
              International: +220 877123456
            </Text>
          </View>
        </View>

        <View className="bg-white dark:bg-slate-900 rounded-2xl p-5 mb-4 shadow-sm">
          <Text className="text-brand-ink dark:text-white text-lg font-bold mb-3">Operator prefixes</Text>
          {OPERATORS.map(op => (
            <View key={op.name} className="flex-row items-center py-2.5 border-b border-slate-100 dark:border-slate-800 last:border-0">
              <View className={`w-9 h-9 rounded-full ${op.color} items-center justify-center mr-3`}>
                <Text className="text-white font-bold text-sm">{op.prefix}</Text>
              </View>
              <View className="flex-1">
                <Text className="text-brand-ink dark:text-white font-semibold text-sm">{op.name}</Text>
                <Text className="text-slate-400 dark:text-slate-500 text-xs">{op.examples.join(' · ')}</Text>
              </View>
            </View>
          ))}
          <Text className="text-slate-400 dark:text-slate-500 text-xs mt-3">
            Gamtel (fixed) and Gamcel (mobile) numbers are not part of the initial migration.
          </Text>
        </View>

        <View className="bg-white dark:bg-slate-900 rounded-2xl p-5 mb-4 shadow-sm">
          <Text className="text-brand-ink dark:text-white text-lg font-bold mb-3">Timeline</Text>
          {TIMELINE.map((item, i) => (
            <View key={item.title} className="flex-row mb-3 last:mb-0">
              <View className="items-center mr-3">
                <View className={`w-3 h-3 rounded-full ${item.active ? 'bg-brand-red' : 'bg-slate-300 dark:bg-slate-700'} mt-1`} />
                {i < TIMELINE.length - 1 && <View className="flex-1 w-px bg-slate-200 dark:bg-slate-800 my-1" />}
              </View>
              <View className="flex-1 pb-2">
                <Text className="text-slate-400 dark:text-slate-500 text-xs font-semibold uppercase tracking-wide">
                  {item.date}
                </Text>
                <Text className="text-brand-ink dark:text-white font-semibold text-sm mt-0.5">
                  {item.title}
                </Text>
                <Text className="text-slate-500 dark:text-slate-400 text-sm mt-0.5">{item.body}</Text>
              </View>
            </View>
          ))}
        </View>

        <View className="bg-white dark:bg-slate-900 rounded-2xl p-5 mb-4 shadow-sm">
          <Text className="text-brand-ink dark:text-white text-lg font-bold mb-1">
            After migrating your contacts
          </Text>
          <Text className="text-slate-500 dark:text-slate-400 text-sm leading-5 mb-3">
            Calls and SMS already use the new 9-digit numbers in your address book. WhatsApp works
            differently: it shows the number each account is{' '}
            <Text className="text-brand-ink dark:text-white font-semibold">registered</Text> with, not
            the one in your contacts. Your contacts&apos; WhatsApp profiles will keep showing the old
            7-digit number until each person migrates their own WhatsApp account — no app can do
            this on their behalf.
          </Text>
          <Text className="text-brand-ink dark:text-white font-semibold text-sm mb-2">
            To switch your own WhatsApp account to 9 digits:
          </Text>
          {[
            'Open WhatsApp → Settings → Account',
            'Tap "Change number" and confirm',
            'Enter your old 7-digit number, then your new 9-digit number',
            'Your chats and history transfer to the new number automatically',
          ].map((step, i) => (
            <View key={step} className="flex-row mb-2">
              <View className="w-6 h-6 rounded-full bg-brand-blue/10 items-center justify-center mr-2.5">
                <Text className="text-brand-blue dark:text-blue-400 font-bold text-xs">
                  {i + 1}
                </Text>
              </View>
              <Text className="text-slate-600 dark:text-slate-300 text-sm flex-1">{step}</Text>
            </View>
          ))}
          <Text className="text-slate-400 dark:text-slate-500 text-xs mt-2">
            Ask the people you contact regularly to do the same, so their WhatsApp profiles match
            the numbers in your address book.
          </Text>
          <View className="mt-3 bg-brand-cream dark:bg-slate-800 rounded-xl p-3">
            <Text className="text-brand-ink dark:text-white font-semibold text-sm mb-1">
              WhatsApp still showing old numbers?
            </Text>
            <Text className="text-slate-500 dark:text-slate-400 text-sm leading-5">
              WhatsApp keeps its own copy of your contacts and re-syncs lazily. Close the app fully
              and reopen it, or toggle WhatsApp&apos;s Contacts permission off and on in system
              settings — either forces a re-sync within a minute.
            </Text>
          </View>
        </View>

        <View className="bg-white dark:bg-slate-900 rounded-2xl p-5 mb-4 shadow-sm">
          <Text className="text-brand-ink dark:text-white text-lg font-bold mb-3">FAQ</Text>
          {FAQ.map((item, i) => (
            <View key={item.q} className="mb-2">
              <Pressable
                onPress={() => setOpenFaq(openFaq === i ? null : i)}
                className="py-2.5 rounded-xl flex-row items-center justify-between active:opacity-70">
                <Text className="text-brand-ink dark:text-white font-semibold text-sm flex-1 mr-2">
                  {item.q}
                </Text>
                <Text className="text-slate-400 text-lg">{openFaq === i ? '−' : '+'}</Text>
              </Pressable>
              {openFaq === i && (
                <Text className="text-slate-500 dark:text-slate-400 text-sm pb-3 leading-5">
                  {item.a}
                </Text>
              )}
            </View>
          ))}
        </View>

        <View className="bg-brand-blue rounded-2xl p-5 mb-4">
          <Text className="text-white text-lg font-bold mb-1">Need help?</Text>
          <Text className="text-blue-100 text-sm mb-3">
            PURA runs a dedicated migration helpdesk for questions about the 9-digit change.
          </Text>
          <View className="flex-row items-center justify-center bg-white/15 rounded-xl py-3">
            <Text className="text-white font-bold text-lg">Dial 148</Text>
            <Text className="text-blue-100 text-xs ml-2">(PURA helpdesk, free)</Text>
          </View>
        </View>

        <Text className="text-center text-slate-400 dark:text-slate-500 text-xs">
          Not affiliated with PURA, Africell, QCell or Comium.{'\n'}
          Always verify the latest official guidance at pura.gm
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  getAllContacts,
  requestContactsPermission,
  restorePhoneNumbers,
  updateContactPhones,
  type PhoneUpdate,
  type RestoreUpdate,
} from '../utils/contacts';
import { analyzeGambianNumber, prettyPrint, type NumberAnalysis, type Operator } from '../utils/migration';
import { getBackups, removeBackup, saveBackup, updateSettings, type BackupChange } from '../utils/storage';

type AppState = 'welcome' | 'permission' | 'scanning' | 'review' | 'updating' | 'success';

interface PendingNumber {
  phoneId: string | undefined;
  original: string;
  analysis: NumberAnalysis;
}

interface PendingContact {
  contactId: string;
  name: string;
  numbers: PendingNumber[];
  selected: boolean;
}

interface ScanStats {
  contacts: number;
  numbers: number;
  alreadyMigrated: number;
  notMigrating: number;
  byOperator: Partial<Record<Operator, number>>;
}

const OPERATOR_STYLES: Record<Operator, { badge: string; text: string }> = {
  Africell: { badge: 'bg-operator-africell', text: 'text-operator-africell' },
  QCell: { badge: 'bg-operator-qcell', text: 'text-operator-qcell' },
  Comium: { badge: 'bg-operator-comium', text: 'text-operator-comium' },
  Gamtel: { badge: 'bg-operator-gamtel', text: 'text-operator-gamtel' },
  Gamcel: { badge: 'bg-operator-gamcel', text: 'text-operator-gamcel' },
  Unknown: { badge: 'bg-slate-400', text: 'text-slate-400' },
};

const FLAG_STRIPES = ['bg-brand-red', 'bg-white', 'bg-brand-blue', 'bg-white', 'bg-brand-green'];

const DUAL_PERIOD_START = new Date('2026-09-04T00:00:00');
const DUAL_PERIOD_END = new Date('2026-12-01T00:00:00');

/** Current time kept in state so the UI can be computed purely at render time. */
function useNow(intervalMs = 60_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

export default function HomeScreen() {
  const now = useNow();
  const [appState, setAppState] = useState<AppState>('welcome');
  const [contacts, setContacts] = useState<PendingContact[]>([]);
  const [scanStats, setScanStats] = useState<ScanStats | null>(null);
  const [query, setQuery] = useState('');
  const [updatedCount, setUpdatedCount] = useState(0);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [scanStage, setScanStage] = useState(0);
  const [hasBackups, setHasBackups] = useState(false);
  const [isReverting, setIsReverting] = useState(false);
  const updatingRef = useRef(false);

  useEffect(() => {
    getBackups().then(b => setHasBackups(b.length > 0));
  }, [appState]);

  const startScanning = useCallback(async () => {
    setAppState('scanning');
    setScanStage(0);

    try {
      setScanStage(1);
      const granted = await requestContactsPermission();

      if (!granted) {
        setAppState('permission');
        return;
      }

      setScanStage(2);
      const details = await getAllContacts();

      const pending: PendingContact[] = [];
      const stats: ScanStats = { contacts: 0, numbers: 0, alreadyMigrated: 0, notMigrating: 0, byOperator: {} };

      for (const contact of details) {
        const numbers: PendingNumber[] = [];
        for (const phone of contact.phones) {
          const analysis = analyzeGambianNumber(phone.number);
          if (!analysis.needsMigration) {
            if (analysis.reason === 'already-migrated') stats.alreadyMigrated++;
            if (analysis.reason === 'not-migrating') stats.notMigrating++;
            continue;
          }
          stats.numbers++;
          stats.byOperator[analysis.operator] = (stats.byOperator[analysis.operator] ?? 0) + 1;
          numbers.push({ phoneId: phone.id, original: phone.number, analysis });
        }

        if (numbers.length > 0) {
          stats.contacts++;
          pending.push({
            contactId: contact.id,
            name: contact.fullName || 'Unnamed contact',
            numbers,
            selected: true,
          });
        }
      }

      if (pending.length === 0) {
        setScanStats(stats);
        setAppState('success');
        setUpdatedCount(0);
        return;
      }

      setContacts(pending);
      setScanStats(stats);
      await updateSettings({ lastScanAt: new Date().toISOString() });
      setAppState('review');
    } catch (error) {
      console.error(error);
      Alert.alert(
        'Contacts unavailable',
        error instanceof Error ? error.message : 'We could not read your contacts. Please try again.'
      );
      setAppState('welcome');
    }
  }, []);

  const toggleContact = useCallback((contactId: string) => {
    setContacts(prev =>
      prev.map(c => (c.contactId === contactId ? { ...c, selected: !c.selected } : c))
    );
  }, []);

  const toggleAll = useCallback((value: boolean) => {
    setContacts(prev => prev.map(c => ({ ...c, selected: value })));
  }, []);

  const performUpdate = useCallback(async () => {
    if (updatingRef.current) return;
    updatingRef.current = true;

    const selected = contacts.filter(c => c.selected);
    const totalNumbers = selected.reduce((n, c) => n + c.numbers.length, 0);
    setUpdatedCount(0);
    setProgress({ done: 0, total: totalNumbers });
    setAppState('updating');

    const changes: BackupChange[] = [];
    let succeededContacts = 0;
    const operatorCounts: Record<string, number> = {};

    for (const item of selected) {
      try {
        const updates: PhoneUpdate[] = item.numbers.map(n => ({
          phoneId: n.phoneId,
          currentNumber: n.original,
          newNumber: n.analysis.display!,
        }));
        const applied = await updateContactPhones(item.contactId, updates);

        if (applied.length > 0) {
          succeededContacts++;
        }
        for (const change of applied) {
          const match = item.numbers.find(
            n => n.phoneId === change.phoneId || n.analysis.display === change.newNumber
          );
          changes.push({
            contactId: item.contactId,
            contactName: item.name,
            phoneId: change.phoneId,
            oldNumber: change.oldNumber,
            newNumber: change.newNumber,
          });
          operatorCounts[match?.analysis.operator ?? 'Unknown'] =
            (operatorCounts[match?.analysis.operator ?? 'Unknown'] ?? 0) + 1;
        }
      } catch (error) {
        console.error('Failed to update contact', item.name, error);
      }

      setProgress(prev => ({ done: prev.done + item.numbers.length, total: prev.total }));
    }

    updatingRef.current = false;

    if (changes.length > 0) {
      await saveBackup({
        runId: `${Date.now()}`,
        createdAt: new Date().toISOString(),
        contactCount: succeededContacts,
        changeCount: changes.length,
        operatorCounts,
        changes,
      });
      await updateSettings({
        lastMigrationAt: new Date().toISOString(),
        totalMigrated: changes.length,
        hasMigratedBefore: true,
      });
    }

    setUpdatedCount(changes.length);
    setAppState('success');
    setHasBackups(true);
  }, [contacts]);

  const removeLastBackup = useCallback(async () => {
    const backups = await getBackups();
    if (backups.length === 0) return;
    await removeBackup(backups[backups.length - 1].runId);
    const remaining = await getBackups();
    setHasBackups(remaining.length > 0);
  }, []);

  const performRevert = useCallback(async () => {
    const backups = await getBackups();
    if (backups.length === 0) {
      Alert.alert('No backups', 'There is nothing to undo yet.');
      return;
    }

    Alert.alert(
      'Undo last migration',
      `Revert the most recent migration (${backups[backups.length - 1].changeCount} number${backups[backups.length - 1].changeCount === 1 ? '' : 's'
      } back to 7 digits)?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Undo',
          style: 'destructive',
          onPress: async () => {
            const run = backups[backups.length - 1];
            setIsReverting(true);
            setAppState('updating');
            setProgress({ done: 0, total: run.changes.length });

            const updates: RestoreUpdate[] = run.changes.map(c => ({
              currentNumber: c.newNumber,
              newNumber: c.oldNumber,
            }));

            let reverted = 0;
            try {
              const result = await restorePhoneNumbers(
                updates,
                (done) => setProgress(prev => ({ done: Math.min(done, prev.total), total: prev.total }))
              );
              reverted = result.restored;
            } catch (error) {
              console.error('Failed to revert migration', error);
            }

            setProgress({ done: run.changes.length, total: run.changes.length });
            await removeLastBackup();
            setIsReverting(false);
            setUpdatedCount(reverted);
            setAppState('success');
          },
        },
      ]
    );
  }, [removeLastBackup]);

  const selectedCount = contacts.filter(c => c.selected).length;
  const selectedNumbers = contacts
    .filter(c => c.selected)
    .reduce((n, c) => n + c.numbers.length, 0);

  const filtered = contacts.filter(c => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      c.numbers.some(n => n.original.includes(q) || n.analysis.display?.includes(q))
    );
  });

  const renderFlag = (className?: string) => (
    <View className={`h-2 w-24 rounded-full overflow-hidden flex-row ${className ?? ''}`}>
      {FLAG_STRIPES.map((stripe, i) => (
        <View key={i} className={`${stripe} flex-1`} />
      ))}
    </View>
  );

  const renderWelcome = () => {
    const cutoffDays = Math.max(0, Math.ceil((DUAL_PERIOD_END.getTime() - now) / 86_400_000));
    const dual = now >= DUAL_PERIOD_START.getTime() && now < DUAL_PERIOD_END.getTime();
    const inRunUp = now < DUAL_PERIOD_START.getTime();

    return (
      <SafeAreaView className="flex-1 bg-brand-cream dark:bg-slate-950">
        <ScrollView contentContainerClassName="p-5 pb-10" className="flex-1">
          <View className="items-center mt-4 mb-6">
            {renderFlag()}
            <Text className="text-brand-ink dark:text-white text-3xl font-extrabold mt-3">
              9Numbers
            </Text>
            <Text className="text-slate-500 dark:text-slate-400 text-sm mt-1">
              The Gambia 9-digit migration helper
            </Text>
          </View>

          {inRunUp || dual ? (
            <View className="bg-brand-blue rounded-2xl p-4 mb-4">
              <Text className="text-white text-xs font-semibold uppercase tracking-wide mb-1">
                {inRunUp ? 'Upcoming change' : 'Dual numbering period'}
              </Text>
              <Text className="text-white text-lg font-bold">
                {inRunUp
                  ? `Migration starts in ${Math.max(0, Math.ceil((DUAL_PERIOD_START.getTime() - now) / 86_400_000))} days`
                  : `${cutoffDays} days left before the hard cut-off`}
              </Text>
              <Text className="text-blue-100 text-sm mt-1">
                {inRunUp
                  ? 'From 4 Sep 2026 numbers will change to 9 digits. Update your contacts ahead of time.'
                  : 'Both 7-digit and 9-digit numbers work until 30 Nov 2026.'}
              </Text>
            </View>
          ) : (
            <View className="bg-brand-red rounded-2xl p-4 mb-4">
              <Text className="text-white text-lg font-bold">9-digit only from 1 Dec 2026</Text>
              <Text className="text-red-100 text-sm mt-1">
                Old 7-digit numbers no longer work. Update your contacts now.
              </Text>
            </View>
          )}

          <View className="bg-white dark:bg-slate-900 rounded-3xl p-5 mb-4 shadow-sm">
            <Text className="text-brand-ink dark:text-white text-lg font-bold mb-2">
              How it works
            </Text>
            {[
              ['1', 'We scan your contacts', 'and find Gambian numbers still in the 7-digit format.'],
              ['2', 'You review the changes', 'operator prefixes (87 / 83 / 86) are applied automatically.'],
              ['3', 'One tap to update', 'everything stays on your phone — no account, no server.'],
            ].map(([title, sub, body]) => (
              <View key={title} className="flex-row mb-4">
                <View className="w-8 h-8 rounded-full bg-brand-red/10 items-center justify-center mr-3">
                  <Text className="text-brand-red font-bold">{title}</Text>
                </View>
                <View className="flex-1">
                  <Text className="text-brand-ink dark:text-white font-semibold text-sm">{sub}</Text>
                  <Text className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">{body}</Text>
                </View>
              </View>
            ))}

            <View className="flex-row flex-wrap gap-2">
              {['Offline & private', 'No SIM change', 'Free', 'Backups included'].map(chip => (
                <View key={chip} className="bg-brand-cream dark:bg-slate-800 rounded-full px-3 py-1.5">
                  <Text className="text-brand-ink dark:text-slate-200 text-xs font-medium">{chip}</Text>
                </View>
              ))}
            </View>
          </View>

          <Pressable
            onPress={startScanning}
            className="bg-brand-red py-4 rounded-2xl active:opacity-80 shadow-md mb-3">
            <Text className="text-white font-bold text-center text-lg">Scan my contacts</Text>
          </Pressable>

          {hasBackups && (
            <Pressable onPress={performRevert} className="py-3 rounded-2xl">
              <Text className="text-brand-ink dark:text-slate-300 font-semibold text-center">
                Undo the last migration
              </Text>
            </Pressable>
          )}
        </ScrollView>
      </SafeAreaView>
    );
  };

  const renderPermission = () => (
    <SafeAreaView className="flex-1 bg-brand-cream dark:bg-slate-950 items-center justify-center p-6">
      <View className="bg-white dark:bg-slate-900 rounded-3xl p-6 w-full max-w-sm items-center">
        <View className="w-14 h-14 rounded-full bg-brand-blue/10 items-center justify-center mb-4">
          <Text className="text-brand-blue dark:text-blue-400 text-2xl font-bold">!</Text>
        </View>
        <Text className="text-brand-ink dark:text-white text-xl font-bold text-center mb-2">
          Contacts access needed
        </Text>
        <Text className="text-slate-500 dark:text-slate-400 text-center text-sm mb-6">
          9Numbers only reads contact numbers, applies the new 9-digit format, and stores a backup
          on this device. Nothing is uploaded.
        </Text>
        <Pressable
          onPress={() => Linking.openSettings()}
          className="bg-brand-red py-3 px-6 rounded-2xl w-full active:opacity-80 mb-2">
          <Text className="text-white font-bold text-center">Open Settings</Text>
        </Pressable>
        <Pressable onPress={startScanning} className="py-2">
          <Text className="text-slate-600 dark:text-slate-300 text-sm font-medium text-center">
            I&apos;ve granted access – try again
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );

  const SCAN_STAGES = ['Requesting contacts permission', 'Reading your contacts', 'Analysing numbers'];

  const renderScanning = () => (
    <View className="flex-1 bg-brand-cream dark:bg-slate-950 items-center justify-center p-6">
      <ActivityIndicator size="large" color="#C8102E" />
      <Text className="mt-6 text-brand-ink dark:text-white font-semibold">
        {SCAN_STAGES[scanStage] ?? SCAN_STAGES[SCAN_STAGES.length - 1]}
      </Text>
      <Text className="mt-1 text-slate-500 dark:text-slate-400 text-sm">
        {scanStage < 2 ? 'This only takes a moment' : 'Most Gambian contacts can be migrated'}
      </Text>
    </View>
  );

  const renderReview = () => {
    const allSelected = contacts.length > 0 && selectedCount === contacts.length;
    const operators = Object.entries(scanStats?.byOperator ?? {}).filter(([, n]) => n > 0);

    return (
      <SafeAreaView className="flex-1 bg-brand-cream dark:bg-slate-950">
        <View className="p-4 pb-3">
          <Text className="text-brand-ink dark:text-white text-2xl font-extrabold">Review changes</Text>
          <Text className="text-slate-500 dark:text-slate-400 text-sm mt-0.5">
            {contacts.length} contacts · {selectedNumbers} numbers ready
          </Text>
        </View>

        <View className="mx-4 mb-3 bg-white dark:bg-slate-900 rounded-2xl p-3 flex-row items-center justify-between">
          <View className="flex-row flex-wrap flex-1 gap-1.5 mr-3">
            {operators.map(([op, n]) => (
              <View key={op} className="flex-row items-center rounded-full bg-brand-cream dark:bg-slate-800 pl-1 pr-2 py-1">
                <View className={`w-2.5 h-2.5 rounded-full mr-1.5 ${OPERATOR_STYLES[op as Operator].badge}`} />
                <Text className="text-brand-ink dark:text-slate-200 text-xs font-medium">
                  {op} · {n}
                </Text>
              </View>
            ))}
            {operators.length === 0 && (
              <Text className="text-slate-500 text-xs">No operator breakdown available</Text>
            )}
          </View>
        </View>

        <View className="mx-4 mb-2 flex-row items-center justify-between">
          <View className="flex-row items-center">
            <Switch
              value={allSelected}
              onValueChange={toggleAll}
              trackColor={{ false: '#cbd5e1', true: '#C8102E' }}
            />
            <Text className="ml-2 text-brand-ink dark:text-white font-medium text-sm">
              {allSelected ? 'Deselect all' : 'Select all'}
            </Text>
          </View>
          <View className="bg-white dark:bg-slate-900 rounded-xl flex-row items-center px-3 py-1.5 w-2/5">
            <Text className="text-slate-400 mr-1">⌕</Text>
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search"
              placeholderTextColor="#94a3b8"
              className="flex-1 text-sm text-brand-ink dark:text-white py-0.5"
            />
          </View>
        </View>

        <ScrollView className="flex-1 px-4" keyboardShouldPersistTaps="handled">
          {filtered.length === 0 && (
            <Text className="text-slate-400 text-center mt-10">No matching contacts</Text>
          )}
          {filtered.map(contact => (
            <View
              key={contact.contactId}
              className="bg-white dark:bg-slate-900 rounded-2xl p-4 mb-3 shadow-sm">
              <View className="flex-row items-center justify-between mb-2">
                <Text className="text-brand-ink dark:text-white font-bold text-base flex-1 mr-2" numberOfLines={1}>
                  {contact.name}
                </Text>
                <Switch
                  value={contact.selected}
                  onValueChange={() => toggleContact(contact.contactId)}
                  trackColor={{ false: '#cbd5e1', true: '#C8102E' }}
                />
              </View>
              {contact.numbers.map(num => (
                <View key={num.phoneId} className="rounded-xl bg-brand-cream dark:bg-slate-800 p-2.5 mb-2 last:mb-0">
                  <View className="flex-row items-center mb-1">
                    <View className={`rounded-full px-2 py-0.5 ${OPERATOR_STYLES[num.analysis.operator].badge}`}>
                      <Text className="text-white text-[10px] font-bold">
                        {num.analysis.operator}
                      </Text>
                    </View>
                    <Text className="text-slate-400 dark:text-slate-500 text-[11px] ml-2">
                      {num.analysis.original}
                    </Text>
                  </View>
                  <View className="flex-row items-center">
                    <Text className="text-slate-400 dark:text-slate-500 text-sm line-through mr-2">
                      {prettyPrint(num.analysis.legacyDigits ?? '')}
                    </Text>
                    <Text className="text-slate-400 text-sm mr-1">→</Text>
                    <Text className={`font-semibold text-sm ${OPERATOR_STYLES[num.analysis.operator].text}`}>
                      {num.analysis.display}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          ))}
          <View className="h-24" />
        </ScrollView>

        <View className="p-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800">
          <Pressable
            onPress={performUpdate}
            disabled={selectedNumbers === 0}
            className={`py-4 rounded-2xl active:opacity-80 ${selectedNumbers > 0 ? 'bg-brand-red' : 'bg-slate-300 dark:bg-slate-700'
              }`}>
            <Text className="text-white font-bold text-center text-lg">
              {selectedNumbers > 0
                ? `Update ${selectedNumbers} number${selectedNumbers === 1 ? '' : 's'} in ${selectedCount} contact${selectedCount === 1 ? '' : 's'}`
                : 'Select at least one contact'}
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  };

  const renderUpdating = () => (
    <View className="flex-1 bg-brand-cream dark:bg-slate-950 items-center justify-center p-6">
      <Text className="text-brand-ink dark:text-white font-bold text-lg mb-2">
        {isReverting ? 'Reverting changes' : 'Updating your contacts'}
      </Text>
      <Text className="text-slate-500 dark:text-slate-400 text-sm mb-6">
        {progress.done} of {progress.total} numbers processed
      </Text>
      <View className="w-64 h-2 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
        <View
          className="h-full bg-brand-red rounded-full"
          style={{ width: `${progress.total > 0 ? (progress.done / progress.total) * 100 : 0}%` }}
        />
      </View>
      <ActivityIndicator size="large" color="#C8102E" className="mt-8" />
      <Text className="mt-3 text-slate-500 dark:text-slate-400 text-xs">
        Please keep 9Numbers in the foreground
      </Text>
    </View>
  );

  const renderSuccess = () => (
    <SafeAreaView className="flex-1 bg-brand-cream dark:bg-slate-950 items-center justify-center p-6">
      <View className="bg-white dark:bg-slate-900 rounded-3xl p-8 w-full max-w-sm items-center">
        <View className="w-16 h-16 rounded-full bg-brand-green/10 items-center justify-center mb-4">
          <Text className="text-brand-green text-3xl">✓</Text>
        </View>
        <Text className="text-brand-ink dark:text-white text-2xl font-extrabold mb-2">
          {updatedCount > 0 ? 'All done!' : 'Nothing to update'}
        </Text>
        <Text className="text-slate-500 dark:text-slate-400 text-center mb-6">
          {updatedCount > 0
            ? `${updatedCount} number${updatedCount === 1 ? '' : 's'} updated to the new 9-digit format. A backup was saved locally so you can undo if needed.`
            : scanStats
              ? `Every Gambian number we found is already in the 9-digit format${scanStats.notMigrating > 0
                ? `. ${scanStats.notMigrating} Gamtel/Gamcel number${scanStats.notMigrating === 1 ? '' : 's'
                } left unchanged (not part of this migration)`
                : ''
              }.`
              : 'Your contacts are up to date.'}
        </Text>
        <Pressable
          onPress={() => setAppState('welcome')}
          className="bg-brand-red py-3.5 px-6 rounded-2xl w-full active:opacity-80 mb-2">
          <Text className="text-white font-bold text-center">Back to home</Text>
        </Pressable>
        <Pressable
          onPress={() => router.push('/backups')}
          className="py-2">
          <Text className="text-slate-600 dark:text-slate-300 text-sm font-medium text-center">
            Manage backups
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );

  switch (appState) {
    case 'welcome':
      return renderWelcome();
    case 'permission':
      return renderPermission();
    case 'scanning':
      return renderScanning();
    case 'review':
      return renderReview();
    case 'updating':
      return renderUpdating();
    case 'success':
      return renderSuccess();
    default:
      return renderWelcome();
  }
}

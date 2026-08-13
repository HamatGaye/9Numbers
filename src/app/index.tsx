import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Linking, ScrollView, Text, View } from 'react-native';

import { NumberCheckerSheet } from '@/components/number-checker';
import { PrefixHero } from '@/components/prefix-hero';
import { ReviewScreen } from '@/components/review-screen';
import {
  Button,
  Card,
  Display,
  Flag,
  Micro,
  Muted,
  Pill,
  Row,
  Screen,
  Stat,
  Title,
  Well,
} from '@/components/ui';
import { BLUE, OPERATOR_UI } from '@/constants/operators';
import { useMigrationStatus } from '@/hooks/use-migration-status';
import { ContactsUnavailableError, requestContactsPermission } from '@/utils/contacts';
import { MIGRATING_OPERATORS, OPERATOR_PREFIXES, type MigratingOperator } from '@/utils/migration';
import { runMigration, runRestore, type RunProgress } from '@/utils/runner';
import {
  assignOperator,
  scanContacts,
  selectedTargets,
  setSelectionFor,
  toggleContact,
  toggleNumber,
  type AttentionItem,
  type ScanResult,
} from '@/utils/scan';
import { getBackups, updateSettings } from '@/utils/storage';

type Stage = 'home' | 'permission' | 'scanning' | 'review' | 'working' | 'done';

/** What the last write actually achieved, so the summary can tell the truth. */
interface Outcome {
  kind: 'migrate' | 'restore';
  applied: number;
  skipped: number;
  failed: number;
  untouched: number;
  alreadyDone: number;
  nothingToDo: boolean;
}

export default function HomeScreen() {
  const status = useMigrationStatus();

  const [stage, setStage] = useState<Stage>('home');
  const [scan, setScan] = useState<ScanResult | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [progress, setProgress] = useState<RunProgress>({ done: 0, total: 0, currentContact: null });
  const [backupCount, setBackupCount] = useState(0);
  const [checkerOpen, setCheckerOpen] = useState(false);
  const [busyLabel, setBusyLabel] = useState('Updating');

  /**
   * Guards against a second write starting while one is in flight. A ref, not
   * state, because it has to be correct synchronously - two fast taps would both
   * read a stale `false` from state and both start writing.
   */
  const writing = useRef(false);

  const refreshBackups = useCallback(() => {
    getBackups().then(b => setBackupCount(b.length));
  }, []);

  useEffect(() => {
    refreshBackups();
  }, [refreshBackups, stage]);

  /* ------------------------------------------------------------- scanning */

  const startScan = useCallback(async () => {
    setStage('scanning');
    try {
      if (!(await requestContactsPermission())) {
        setStage('permission');
        return;
      }

      const result = await scanContacts();
      setScan(result);
      await updateSettings({ lastScanAt: new Date().toISOString() });

      if (result.contacts.length === 0) {
        setOutcome({
          kind: 'migrate',
          applied: 0,
          skipped: 0,
          failed: 0,
          untouched: result.summary.byReason['not-migrating'],
          alreadyDone: result.summary.byReason['already-migrated'],
          nothingToDo: true,
        });
        setStage('done');
        return;
      }

      setStage('review');
    } catch (error) {
      console.error('[9Numbers] scan failed', error);
      Alert.alert(
        'Could not read contacts',
        error instanceof ContactsUnavailableError || error instanceof Error
          ? error.message
          : 'Please try again.'
      );
      setStage('home');
    }
  }, []);

  /* -------------------------------------------------------------- writing */

  const confirmMigration = useCallback(async () => {
    if (writing.current || !scan) return;
    const targets = selectedTargets(scan.contacts);
    if (targets.length === 0) return;

    writing.current = true;
    setBusyLabel('Updating');
    setProgress({ done: 0, total: targets.length, currentContact: null });
    setStage('working');

    try {
      const result = await runMigration(targets, setProgress);
      setOutcome({
        kind: 'migrate',
        applied: result.appliedCount,
        // 'already-applied' means the number was already correct, which is the
        // outcome the user wanted - not worth reporting as a skip.
        skipped: result.skipped.filter(s => s.code !== 'already-applied').length,
        failed: result.failedContacts.length,
        untouched: scan.summary.byReason['not-migrating'],
        alreadyDone: scan.summary.byReason['already-migrated'],
        nothingToDo: result.appliedCount === 0 && result.failedContacts.length === 0,
      });
      setStage('done');
    } catch (error) {
      console.error('[9Numbers] migration failed', error);
      Alert.alert('Update failed', error instanceof Error ? error.message : 'Nothing was changed.');
      setStage('review');
    } finally {
      writing.current = false;
    }
  }, [scan]);

  const undoLast = useCallback(async () => {
    const backups = await getBackups();
    const run = backups[backups.length - 1];
    if (!run) {
      refreshBackups();
      return;
    }

    Alert.alert(
      'Undo last update?',
      `${run.changeCount} number${run.changeCount === 1 ? '' : 's'} will go back to 7 digits.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Undo',
          style: 'destructive',
          onPress: async () => {
            if (writing.current) return;
            writing.current = true;
            setBusyLabel('Restoring');
            setProgress({ done: 0, total: run.changes.length, currentContact: null });
            setStage('working');

            try {
              const result = await runRestore(run, setProgress);
              setOutcome({
                kind: 'restore',
                applied: result.revertedCount,
                skipped: result.remaining.length,
                failed: result.failedContacts.length,
                untouched: 0,
                alreadyDone: 0,
                nothingToDo: result.revertedCount === 0 && result.failedContacts.length === 0,
              });
              setStage('done');
            } catch (error) {
              console.error('[9Numbers] undo failed', error);
              Alert.alert(
                'Undo failed',
                error instanceof Error ? error.message : 'Your backup is still saved.'
              );
              setStage('home');
            } finally {
              writing.current = false;
              refreshBackups();
            }
          },
        },
      ]
    );
  }, [refreshBackups]);

  /* -------------------------------------------------------------- editing */

  const onToggleNumber = useCallback((phoneId: string) => {
    setScan(p => (p ? { ...p, contacts: toggleNumber(p.contacts, phoneId) } : p));
  }, []);

  const onToggleContact = useCallback((contactId: string) => {
    setScan(p => (p ? { ...p, contacts: toggleContact(p.contacts, contactId) } : p));
  }, []);

  const onSetVisibleSelection = useCallback((ids: Set<string>, selected: boolean) => {
    setScan(p => (p ? { ...p, contacts: setSelectionFor(p.contacts, ids, selected) } : p));
  }, []);

  const onAssignOperator = useCallback((item: AttentionItem, operator: MigratingOperator) => {
    setScan(p =>
      p
        ? {
          ...p,
          contacts: assignOperator(p.contacts, item, operator),
          attention: p.attention.filter(a => a.phoneId !== item.phoneId),
        }
        : p
    );
  }, []);

  /* -------------------------------------------------------------- screens */

  if (stage === 'review' && scan) {
    return (
      <ReviewScreen
        result={scan}
        onToggleNumber={onToggleNumber}
        onToggleContact={onToggleContact}
        onSetVisibleSelection={onSetVisibleSelection}
        onAssignOperator={onAssignOperator}
        onConfirm={confirmMigration}
        onCancel={() => setStage('home')}
      />
    );
  }

  if (stage === 'scanning') {
    return (
      <Screen center>
        <ActivityIndicator size="large" color={BLUE} />
        <Title className="mt-6">Reading contacts</Title>
        <Micro className="mt-1.5">Nothing has changed yet</Micro>
      </Screen>
    );
  }

  if (stage === 'working') {
    const pct = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;
    return (
      <Screen center className="px-10">
        <Display className="text-center">{pct}%</Display>
        <Title className="mt-2">{busyLabel}</Title>
        <View className="w-full h-1 mt-6 rounded-full overflow-hidden bg-paper-sunken dark:bg-night-sunken">
          <View className="h-full bg-blue rounded-full" style={{ width: `${pct}%` }} />
        </View>
        <Micro className="mt-3" numberOfLines={1}>
          {progress.currentContact ?? ' '}
        </Micro>
        <Micro className="mt-10 text-center">Keep the app open</Micro>
      </Screen>
    );
  }

  if (stage === 'done' && outcome) {
    return (
      <DoneScreen
        outcome={outcome}
        backupCount={backupCount}
        onHome={() => {
          setStage('home');
          setScan(null);
          setOutcome(null);
        }}
        onUndo={undoLast}
      />
    );
  }

  if (stage === 'permission') {
    return (
      <Screen center className="px-8">
        <View className="w-14 h-14 rounded-2xl bg-paper-sunken dark:bg-night-sunken items-center justify-center mb-5">
          <Text className="text-2xl">🔒</Text>
        </View>
        <Title className="text-center">Contacts access needed</Title>
        <Muted className="text-center mt-2">Nothing leaves your phone.</Muted>
        <Button
          label="Open settings"
          onPress={() => Linking.openSettings()}
          className="w-full mt-8"
        />
        <Button label="Try again" tone="ghost" onPress={startScan} className="w-full mt-1" />
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-5 pt-4 pb-8"
        showsVerticalScrollIndicator={false}>
        {/* Masthead: wordmark, and the only sentence on the screen. */}
        <Row>
          <View className="flex-1">
            <Row>
              <Flag className="h-1 w-7" />
              <Text className="font-display text-ink dark:text-chalk text-lg ml-2.5">7to9</Text>
            </Row>
          </View>
          <Pill label={status.pill} tone={status.urgent ? 'warn' : 'blue'} />
        </Row>

        {/* The change, shown rather than described. */}
        <View className="mt-5">
          <PrefixHero />
        </View>

        {/* Prefix reference as three tiles - scannable at a glance. */}
        <Row className="mt-3 gap-2.5">
          {MIGRATING_OPERATORS.map(operator => (
            <View
              key={operator}
              className="flex-1 rounded-2xl bg-paper-raised dark:bg-night-raised border border-paper-line dark:border-night-line px-3 py-3.5 items-center">
              <View className={`w-1.5 h-1.5 rounded-full mb-2 ${OPERATOR_UI[operator].bg}`} />
              <Text className="font-mono text-ink dark:text-chalk text-xl font-bold">
                {OPERATOR_PREFIXES[operator]}
              </Text>
              <Micro className="mt-0.5">{operator}</Micro>
            </View>
          ))}
        </Row>

        <Button label="Scan my contacts" onPress={startScan} className="mt-6" />
        <Button
          label="Check one number"
          tone="quiet"
          onPress={() => setCheckerOpen(true)}
          className="mt-2.5"
        />

        <Muted className="mt-6 text-center">{status.note}</Muted>

        {backupCount > 0 && (
          <Row className="mt-2 justify-center">
            <Button label="Undo last update" tone="danger" onPress={undoLast} />
          </Row>
        )}
      </ScrollView>

      <NumberCheckerSheet visible={checkerOpen} onClose={() => setCheckerOpen(false)} />
    </Screen>
  );
}

/**
 * The result. Numbers, not sentences — and skips and failures are shown rather
 * than hidden, because "139 updated" while 3 silently failed is the kind of
 * half-truth that leaves someone unreachable without knowing it.
 */
function DoneScreen({
  outcome,
  backupCount,
  onHome,
  onUndo,
}: {
  outcome: Outcome;
  backupCount: number;
  onHome: () => void;
  onUndo: () => void;
}) {
  const clean = outcome.skipped === 0 && outcome.failed === 0;

  return (
    <Screen>
      <View className="flex-1 justify-center px-6">
        <View className="items-center">
          <View
            className={`w-16 h-16 rounded-full items-center justify-center ${clean ? 'bg-good/15' : 'bg-warn/15'
              }`}>
            <Text className={`text-2xl ${clean ? 'text-good' : 'text-warn'}`}>
              {clean ? '✓' : '!'}
            </Text>
          </View>

          <Title className="mt-5 text-center">
            {outcome.nothingToDo
              ? 'Nothing to change'
              : outcome.kind === 'restore'
                ? 'Numbers restored'
                : 'Contacts updated'}
          </Title>
        </View>

        {!outcome.nothingToDo && (
          <Card className="mt-7 py-5">
            <Row>
              <Stat value={outcome.applied} label={outcome.kind === 'restore' ? 'restored' : 'updated'} />
              {outcome.kind === 'migrate' && (
                <>
                  <View className="w-px h-10 bg-paper-line dark:bg-night-line" />
                  <Stat value={outcome.alreadyDone} label="already 9-digit" />
                  <View className="w-px h-10 bg-paper-line dark:bg-night-line" />
                  <Stat value={outcome.untouched} label="left untouched" />
                </>
              )}
            </Row>
          </Card>
        )}

        {(outcome.skipped > 0 || outcome.failed > 0) && (
          <Well className="mt-3 p-4">
            {outcome.skipped > 0 && (
              <Row>
                <Text className="text-warn text-xs font-bold w-6">{outcome.skipped}</Text>
                <Micro className="flex-1">changed since the scan — left alone</Micro>
              </Row>
            )}
            {outcome.failed > 0 && (
              <Row className={outcome.skipped > 0 ? 'mt-2' : ''}>
                <Text className="text-bad text-xs font-bold w-6">{outcome.failed}</Text>
                <Micro className="flex-1">could not be written — scan again to retry</Micro>
              </Row>
            )}
          </Well>
        )}

        {outcome.kind === 'migrate' && outcome.applied > 0 && (
          <Row className="mt-6 justify-center">
            <Micro>Made a mistake?</Micro>
            <Text className="mx-2 text-ink-soft dark:text-chalk-soft">·</Text>
            <Button label="Undo" tone="danger" onPress={onUndo} className="py-0 px-0" />
          </Row>
        )}
      </View>

      <View className="px-6 pb-4">
        <Button label="Done" onPress={onHome} />
        {backupCount > 0 && (
          <Button
            label="Backups"
            tone="ghost"
            onPress={() => router.push('/backups')}
            className="mt-1"
          />
        )}
      </View>
    </Screen>
  );
}

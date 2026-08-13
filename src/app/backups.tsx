import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { alert } from '@/components/alert';
import {
  Button,
  Card,
  Divider,
  Micro,
  Muted,
  Pill,
  Row,
  Screen,
  Sheet,
  Stat,
  Title,
  Well,
} from '@/components/ui';
import { operatorStyle } from '@/constants/operators';
import { prettyPrint } from '@/utils/migration';
import { runRestore } from '@/utils/runner';
import { clearBackups, getBackups, removeBackup, type BackupRun } from '@/utils/storage';

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  return date.toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** `+220 877123456` -> `877 123 456`. */
function short(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  return prettyPrint(digits.length > 9 ? digits.slice(-9) : digits);
}

export default function BackupsScreen() {
  const [backups, setBackups] = useState<BackupRun[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [detail, setDetail] = useState<BackupRun | null>(null);

  const refresh = useCallback(() => {
    getBackups().then(setBackups);
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  /**
   * Restores one run through the shared runner.
   *
   * The screen no longer decides what happens to the backup afterwards - the
   * runner keeps whatever could not be undone. That is the fix for the old
   * behaviour, where attempting a restore deleted the backup even if every
   * contact had failed, leaving changed numbers and no way back.
   */
  const restore = useCallback(
    (run: BackupRun) => {
      alert(
        'Restore old numbers?',
        `${run.changeCount} number${run.changeCount === 1 ? '' : 's'} will go back to 7 digits.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Restore',
            style: 'destructive',
            onPress: async () => {
              setBusyId(run.runId);
              try {
                const result = await runRestore(run);
                refresh();
                setDetail(null);

                if (result.revertedCount === 0) {
                  alert(
                    'Nothing restored',
                    result.failedContacts.length > 0
                      ? 'Your contacts could not be written to. The backup is still saved.'
                      : 'These numbers are no longer on this phone in the form we saved.'
                  );
                  return;
                }

                alert(
                  'Restored',
                  result.remaining.length > 0
                    ? `${result.revertedCount} done, ${result.remaining.length} still in this backup.`
                    : `${result.revertedCount} number${result.revertedCount === 1 ? '' : 's'} restored.`
                );
              } catch (error) {
                console.error('[7To9] restore failed', error);
                alert(
                  'Restore failed',
                  error instanceof Error ? error.message : 'Your backup is still saved.'
                );
              } finally {
                setBusyId(null);
              }
            },
          },
        ]
      );
    },
    [refresh]
  );

  const remove = useCallback(
    (run: BackupRun) => {
      alert('Delete this backup?', 'Your numbers stay as they are. The undo is lost.', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await removeBackup(run.runId);
            setDetail(null);
            refresh();
          },
        },
      ]);
    },
    [refresh]
  );

  const clearAll = useCallback(() => {
    alert('Delete all backups?', 'Your numbers stay as they are. All undos are lost.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete all',
        style: 'destructive',
        onPress: async () => {
          await clearBackups();
          refresh();
        },
      },
    ]);
  }, [refresh]);

  if (backups.length === 0) {
    return (
      <Screen center className="px-10">
        <View className="w-14 h-14 rounded-full bg-paper-sunken dark:bg-night-sunken items-center justify-center">
          <Text className="text-ink-soft dark:text-chalk-soft text-xl">↩</Text>
        </View>
        <Title className="mt-5 text-center">No backups</Title>
        <Muted className="mt-2 text-center">Every update saves your old numbers here.</Muted>
        <Button
          label="Update my contacts"
          onPress={() => router.replace('/')}
          className="mt-8 w-full"
        />
      </Screen>
    );
  }

  const totalNumbers = backups.reduce((n, b) => n + b.changeCount, 0);

  return (
    <Screen>
      <Row className="px-5 pt-2 pb-4">
        <View className="flex-1">
          <Title>Backups</Title>
          <Micro className="mt-0.5">{totalNumbers} numbers · this phone only</Micro>
        </View>
        <Button label="Clear all" tone="danger" onPress={clearAll} className="py-0 px-0" />
      </Row>

      <ScrollView className="flex-1 px-5" contentContainerClassName="pb-10">
        {/* Newest first: the undo you want is almost always the last one. */}
        {[...backups].reverse().map((run, idx) => (
          <Pressable
            key={run.runId}
            onPress={() => setDetail(run)}
            accessibilityRole="button"
            className="mb-2.5 active:opacity-70">
            <Card className="px-4 py-4">
              <Row>
                <View className="flex-1">
                  <Row>
                    <Text className="text-ink dark:text-chalk text-[15px] font-semibold">
                      {formatDate(run.createdAt)}
                    </Text>
                    {idx === 0 && (
                      <View className="ml-2">
                        <Pill label="Latest" tone="blue" />
                      </View>
                    )}
                  </Row>
                  <Micro className="mt-1">
                    {run.changeCount} number{run.changeCount === 1 ? '' : 's'} · {run.contactCount}{' '}
                    contact{run.contactCount === 1 ? '' : 's'}
                  </Micro>
                </View>
                <Row className="gap-1.5">
                  {Object.entries(run.operatorCounts)
                    .filter(([, n]) => n > 0)
                    .map(([operator]) => (
                      <View
                        key={operator}
                        className={`w-2 h-2 rounded-full ${operatorStyle(operator).bg}`}
                      />
                    ))}
                  <Text className="text-ink-soft dark:text-chalk-soft text-xs ml-1.5">›</Text>
                </Row>
              </Row>
            </Card>
          </Pressable>
        ))}
      </ScrollView>

      {/* One backup, in detail */}
      <Sheet visible={!!detail} onClose={() => setDetail(null)} title="Backup">
        {detail && (
          <>
            <Card className="py-5">
              <Row>
                <Stat value={detail.changeCount} label="numbers" />
                <View className="w-px h-10 bg-paper-line dark:bg-night-line" />
                <Stat value={detail.contactCount} label="contacts" />
              </Row>
            </Card>

            <Well className="mt-3 px-4 py-1">
              {detail.changes.slice(0, 40).map((change, i) => (
                <View key={`${change.contactId}-${change.phoneId}`}>
                  {i > 0 && <Divider />}
                  <View className="py-2.5">
                    <Text
                      className="text-ink dark:text-chalk text-[13px] font-semibold"
                      numberOfLines={1}>
                      {change.contactName}
                    </Text>
                    <Row className="mt-0.5">
                      <Text className="font-mono text-ink-soft dark:text-chalk-soft text-[12px]">
                        {short(change.newNumber)}
                      </Text>
                      <Text className="text-ink-soft dark:text-chalk-soft text-[10px] mx-2">→</Text>
                      <Text className="font-mono text-ink dark:text-chalk text-[12px] font-bold">
                        {short(change.oldNumber)}
                      </Text>
                    </Row>
                  </View>
                </View>
              ))}
              {detail.changes.length > 40 && (
                <Micro className="py-2.5">+{detail.changes.length - 40} more</Micro>
              )}
            </Well>

            <Button
              label={busyId === detail.runId ? 'Restoring…' : 'Restore these numbers'}
              disabled={busyId === detail.runId}
              onPress={() => restore(detail)}
              className="mt-4"
            />
            <Button
              label="Delete backup"
              tone="danger"
              onPress={() => remove(detail)}
              className="mt-1"
            />
          </>
        )}
      </Sheet>
    </Screen>
  );
}

import { Contact, ContactField } from 'expo-contacts';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { clearBackups, getBackups, removeBackup, type BackupRun } from '../utils/storage';

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const OPERATOR_COLORS: Record<string, string> = {
  Africell: '#E11D48',
  QCell: '#D97706',
  Comium: '#2563EB',
};

export default function BackupsScreen() {
  const [backups, setBackups] = useState<BackupRun[]>([]);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  const refresh = useCallback(() => {
    getBackups().then(setBackups);
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const restoreRun = useCallback(
    async (run: BackupRun) => {
      Alert.alert(
        'Restore this backup',
        `Revert ${run.changeCount} number${run.changeCount === 1 ? '' : 's'} across ${
          run.contactCount
        } contact${run.contactCount === 1 ? '' : 's'} back to the 7-digit format?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Restore',
            style: 'destructive',
            onPress: async () => {
              setRestoringId(run.runId);
              const byContact = new Map<string, typeof run.changes>();
              for (const change of run.changes) {
                const list = byContact.get(change.contactId) ?? [];
                list.push(change);
                byContact.set(change.contactId, list);
              }

              let reverted = 0;
              let failed = 0;
              for (const [contactId, changes] of byContact) {
                try {
                  const contact = new Contact(contactId);
                  const details = await contact.getDetails([ContactField.PHONES]);
                  const phones = (details.phones ?? []).map(phone => {
                    const match =
                      changes.find(c => c.phoneId && c.phoneId === phone.id) ??
                      changes.find(c => phone.number === c.newNumber);
                    if (!match) return phone;
                    reverted++;
                    return { ...phone, number: match.oldNumber };
                  });
                  await contact.patch({ phones });
                } catch (error) {
                  console.error('Failed to restore contact', contactId, error);
                  failed++;
                }
              }

              setRestoringId(null);
              if (failed === byContact.size) {
                Alert.alert('Restore failed', 'None of the contacts could be restored.');
              } else {
                await removeBackup(run.runId);
                refresh();
                Alert.alert(
                  'Restore complete',
                  `${reverted} number${reverted === 1 ? '' : 's'} restored.${failed > 0 ? ` ${failed} contact${failed === 1 ? '' : 's'} failed.` : ''}`
                );
              }
            },
          },
        ]
      );
    },
    [refresh]
  );

  const clearAll = useCallback(() => {
    Alert.alert('Delete all backups?', 'You will no longer be able to undo any migrations.', [
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

  return (
    <SafeAreaView className="flex-1 bg-brand-cream dark:bg-slate-950">
      <View className="p-4 pb-3 flex-row items-center justify-between">
        <View>
          <Text className="text-brand-ink dark:text-white text-2xl font-extrabold">Backups</Text>
          <Text className="text-slate-500 dark:text-slate-400 text-sm mt-0.5">
            Stored on this device only
          </Text>
        </View>
        {backups.length > 0 && (
          <Pressable onPress={clearAll} className="px-3 py-2 rounded-xl active:opacity-70">
            <Text className="text-brand-red font-semibold text-sm">Clear all</Text>
          </Pressable>
        )}
      </View>

      {backups.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8 pb-16">
          <View className="w-16 h-16 rounded-full bg-slate-200 dark:bg-slate-800 items-center justify-center mb-4">
            <Text className="text-slate-500 dark:text-slate-400 text-2xl">↩</Text>
          </View>
          <Text className="text-brand-ink dark:text-white text-lg font-bold text-center mb-1">
            No backups yet
          </Text>
          <Text className="text-slate-500 dark:text-slate-400 text-center text-sm">
            After you migrate your contacts, a backup is saved here so you can restore the old
            7-digit numbers at any time.
          </Text>
          <Pressable
            onPress={() => router.push('/')}
            className="bg-brand-red py-3 px-8 rounded-2xl mt-6 active:opacity-80">
            <Text className="text-white font-bold">Migrate contacts</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView className="flex-1 px-4" contentContainerClassName="pb-10">
          {[...backups]
            .reverse()
            .map((run, idx) => (
              <View key={run.runId} className="bg-white dark:bg-slate-900 rounded-2xl p-4 mb-3 shadow-sm">
                <View className="flex-row items-center justify-between mb-2">
                  <Text className="text-brand-ink dark:text-white font-bold">
                    {formatDate(run.createdAt)}
                  </Text>
                  <View className="bg-brand-cream dark:bg-slate-800 rounded-full px-2.5 py-1">
                    <Text className="text-brand-ink dark:text-slate-200 text-xs font-semibold">
                      {idx === 0 ? 'Most recent' : `Run #${backups.length - idx}`}
                    </Text>
                  </View>
                </View>

                <Text className="text-slate-500 dark:text-slate-400 text-sm mb-3">
                  {run.changeCount} number{run.changeCount === 1 ? '' : 's'} · {run.contactCount}{' '}
                  contact{run.contactCount === 1 ? '' : 's'}
                </Text>

                {Object.keys(run.operatorCounts).length > 0 && (
                  <View className="flex-row flex-wrap gap-1.5 mb-3">
                    {Object.entries(run.operatorCounts).map(([op, count]) => (
                      <View key={op} className="flex-row items-center rounded-full bg-brand-cream dark:bg-slate-800 pl-1 pr-2 py-1">
                        <View
                          className="w-2.5 h-2.5 rounded-full mr-1.5"
                          style={{ backgroundColor: OPERATOR_COLORS[op] ?? '#94a3b8' }}
                        />
                        <Text className="text-brand-ink dark:text-slate-200 text-xs font-medium">
                          {op} · {count}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}

                <Pressable
                  disabled={restoringId === run.runId}
                  onPress={() => restoreRun(run)}
                  className={`py-2.5 rounded-xl items-center ${
                    restoringId === run.runId
                      ? 'bg-slate-200 dark:bg-slate-800'
                      : 'bg-brand-cream dark:bg-slate-800 active:opacity-70'
                  }`}>
                  <Text className="text-brand-ink dark:text-white font-semibold text-sm">
                    {restoringId === run.runId ? 'Restoring…' : 'Restore these numbers'}
                  </Text>
                </Pressable>
              </View>
            ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

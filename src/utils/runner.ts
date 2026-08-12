/**
 * The one place that writes to the address book.
 *
 * Both directions of the migration live here so they cannot drift apart:
 *   - `runMigration` adds operator prefixes.
 *   - `runRestore`   puts the original numbers back.
 *
 * Both report exactly what happened rather than swallowing failures, which is
 * what lets the UI tell the truth ("47 updated, 2 skipped") and what lets a
 * partly-failed undo keep the rest of its backup.
 */

import {
  updateContactPhones,
  type PhoneUpdate,
  type SkippedChange,
} from './contacts';
import {
  createRunId,
  replaceBackupChanges,
  saveBackup,
  recordMigration,
  type BackupChange,
  type BackupRun,
} from './storage';
import type { NumberAnalysis, Operator } from './migration';

export interface MigrationTarget {
  contactId: string;
  contactName: string;
  phoneId: string;
  analysis: NumberAnalysis;
}

export interface RunProgress {
  done: number;
  total: number;
  /** Name of the contact currently being written, for the progress screen. */
  currentContact: string | null;
}

export interface MigrationResult {
  /** Numbers successfully rewritten. */
  appliedCount: number;
  /** Numbers deliberately left alone because the device had moved on. */
  skipped: SkippedChange[];
  /** Contacts that could not be written at all, with the reason. */
  failedContacts: { contactId: string; contactName: string; message: string }[];
  /** The backup that was saved, or null when there was nothing to back up. */
  backup: BackupRun | null;
}

export interface RestoreResult {
  revertedCount: number;
  /** Changes that could not be undone and are still worth retrying. */
  remaining: BackupChange[];
  failedContacts: { contactId: string; contactName: string; message: string }[];
  /** True when the run is now empty and was removed from the backup list. */
  runCleared: boolean;
}

type ProgressFn = (progress: RunProgress) => void;

function groupByContact<T extends { contactId: string }>(items: T[]): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const list = map.get(item.contactId);
    if (list) list.push(item);
    else map.set(item.contactId, [item]);
  }
  return map;
}

/**
 * Adds the operator prefix to every target, contact by contact.
 *
 * A backup is written only for numbers that actually changed on the device, so
 * the undo list can never promise to restore something that was never touched.
 */
export async function runMigration(
  targets: MigrationTarget[],
  onProgress?: ProgressFn
): Promise<MigrationResult> {
  const byContact = groupByContact(targets);
  const total = targets.length;

  const changes: BackupChange[] = [];
  const skipped: SkippedChange[] = [];
  const failedContacts: MigrationResult['failedContacts'] = [];
  const operatorCounts: Record<string, number> = {};

  let done = 0;

  for (const [contactId, group] of byContact) {
    const contactName = group[0].contactName;
    onProgress?.({ done, total, currentContact: contactName });

    // `write` is non-null for every target the scanner marks as migratable;
    // filter defensively so a null can never be stringified into a contact.
    const updates: PhoneUpdate[] = group
      .filter(t => !!t.analysis.write)
      .map(t => ({
        phoneId: t.phoneId,
        currentNumber: t.analysis.original,
        newNumber: t.analysis.write as string,
      }));

    const outcome = await updateContactPhones(contactId, updates);

    if (outcome.error) {
      failedContacts.push({ contactId, contactName, message: outcome.error.message });
    }

    skipped.push(...outcome.skipped);

    for (const change of outcome.applied) {
      const target = group.find(t => t.phoneId === change.phoneId);
      const operator: Operator = target?.analysis.operator ?? 'Unknown';
      changes.push({
        contactId,
        contactName,
        phoneId: change.phoneId,
        oldNumber: change.oldNumber,
        newNumber: change.newNumber,
      });
      operatorCounts[operator] = (operatorCounts[operator] ?? 0) + 1;
    }

    // Count the whole group as processed regardless of outcome, so the bar
    // always reaches 100% even when some contacts fail.
    done += group.length;
    onProgress?.({ done, total, currentContact: contactName });
  }

  let backup: BackupRun | null = null;
  if (changes.length > 0) {
    backup = {
      runId: createRunId(),
      createdAt: new Date().toISOString(),
      contactCount: new Set(changes.map(c => c.contactId)).size,
      changeCount: changes.length,
      operatorCounts,
      changes,
    };
    await saveBackup(backup);
    await recordMigration(changes.length);
  }

  return { appliedCount: changes.length, skipped, failedContacts, backup };
}

/**
 * Puts the numbers in a backup run back the way they were.
 *
 * Only the changes that really went back are removed from the run. Anything
 * that failed, or that the user has since edited by hand, stays in the backup
 * so it can be retried. The previous version deleted the whole backup as soon
 * as a restore was attempted, so a failed undo lost the ability to undo at all.
 */
export async function runRestore(
  run: BackupRun,
  onProgress?: ProgressFn
): Promise<RestoreResult> {
  const byContact = groupByContact(run.changes);
  const total = run.changes.length;

  const failedContacts: RestoreResult['failedContacts'] = [];
  const remaining: BackupChange[] = [];
  let revertedCount = 0;
  let done = 0;

  for (const [contactId, group] of byContact) {
    const contactName = group[0].contactName;
    onProgress?.({ done, total, currentContact: contactName });

    // Reverse direction: what we wrote becomes "current", the original becomes
    // the new value.
    const updates: PhoneUpdate[] = group.map(c => ({
      phoneId: c.phoneId,
      currentNumber: c.newNumber,
      newNumber: c.oldNumber,
    }));

    const outcome = await updateContactPhones(contactId, updates);

    if (outcome.error) {
      failedContacts.push({ contactId, contactName, message: outcome.error.message });
      // The whole contact is retryable.
      remaining.push(...group);
      done += group.length;
      continue;
    }

    revertedCount += outcome.applied.length;

    for (const skip of outcome.skipped) {
      const change = group.find(c => c.phoneId === skip.phoneId);
      if (!change) continue;
      // 'changed' means the user edited the number themselves: keep it so they
      // can retry, but never silently overwrite their edit.
      // 'missing' (row deleted) and 'already-applied' are settled - drop them.
      if (skip.code === 'changed') remaining.push(change);
    }

    done += group.length;
    onProgress?.({ done, total, currentContact: contactName });
  }

  await replaceBackupChanges(run.runId, remaining);

  return {
    revertedCount,
    remaining,
    failedContacts,
    runCleared: remaining.length === 0,
  };
}

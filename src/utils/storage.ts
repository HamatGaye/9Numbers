import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Local-only persistence for migration backups and app settings.
 * No backend - everything stays on the device.
 */

const BACKUP_KEY = '@9numbers/backups';
const SETTINGS_KEY = '@9numbers/settings';

/**
 * How many migration runs we keep. Each change is a few hundred bytes, so this
 * is generous, but it stops AsyncStorage from growing without bound if someone
 * runs a migration every day. The OLDEST runs are dropped first, so the undo
 * you are most likely to want is always the one that survives.
 */
const MAX_BACKUP_RUNS = 20;

export interface BackupChange {
  contactId: string;
  contactName: string;
  phoneId: string;
  oldNumber: string;
  newNumber: string;
}

export interface BackupRun {
  runId: string;
  createdAt: string; // ISO timestamp
  contactCount: number;
  changeCount: number;
  operatorCounts: Record<string, number>;
  changes: BackupChange[];
}

export interface AppSettings {
  lastScanAt: string | null;
  lastMigrationAt: string | null;
  /** Cumulative count across every run ever made on this device. */
  totalMigrated: number;
  hasMigratedBefore: boolean;
}

const DEFAULT_SETTINGS: AppSettings = {
  lastScanAt: null,
  lastMigrationAt: null,
  totalMigrated: 0,
  hasMigratedBefore: false,
};

/** Cheap guard against a corrupted or hand-edited store. */
function isBackupRun(value: unknown): value is BackupRun {
  if (!value || typeof value !== 'object') return false;
  const run = value as Partial<BackupRun>;
  return typeof run.runId === 'string' && Array.isArray(run.changes);
}

export async function getBackups(): Promise<BackupRun[]> {
  try {
    const raw = await AsyncStorage.getItem(BACKUP_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isBackupRun);
  } catch {
    return [];
  }
}

/**
 * Builds a run id that stays unique even when two runs land in the same
 * millisecond. `Date.now()` alone was not enough: a fast undo-then-migrate
 * could produce two runs sharing an id, and `removeBackup` would delete both.
 */
export function createRunId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function saveBackup(run: BackupRun): Promise<void> {
  const backups = await getBackups();
  backups.push(run);
  const trimmed = backups.slice(-MAX_BACKUP_RUNS);
  await AsyncStorage.setItem(BACKUP_KEY, JSON.stringify(trimmed));
}

export async function removeBackup(runId: string): Promise<BackupRun[]> {
  const backups = await getBackups();
  const next = backups.filter(b => b.runId !== runId);
  await AsyncStorage.setItem(BACKUP_KEY, JSON.stringify(next));
  return next;
}

/**
 * Rewrites a run, keeping only the changes that are still undoable.
 *
 * Used after a partial restore: the numbers that went back to 7 digits are gone
 * from the run, while the ones that failed stay so the user can retry. This is
 * what stops a half-finished undo from throwing away the rest of the backup.
 */
export async function replaceBackupChanges(
  runId: string,
  changes: BackupChange[]
): Promise<BackupRun[]> {
  if (changes.length === 0) return removeBackup(runId);

  const backups = await getBackups();
  const next = backups.map(run =>
    run.runId === runId
      ? {
          ...run,
          changes,
          changeCount: changes.length,
          contactCount: new Set(changes.map(c => c.contactId)).size,
          operatorCounts: run.operatorCounts,
        }
      : run
  );
  await AsyncStorage.setItem(BACKUP_KEY, JSON.stringify(next));
  return next;
}

export async function clearBackups(): Promise<void> {
  await AsyncStorage.removeItem(BACKUP_KEY);
}

export async function getSettings(): Promise<AppSettings> {
  try {
    const raw = await AsyncStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function updateSettings(patch: Partial<AppSettings>): Promise<AppSettings> {
  const current = await getSettings();
  const next = { ...current, ...patch };
  await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
  return next;
}

/**
 * Records a finished migration run. `totalMigrated` ACCUMULATES; it used to be
 * assigned the size of the latest run, so a second migration of 1 number reset
 * a lifetime total of 300 down to 1.
 */
export async function recordMigration(changeCount: number): Promise<AppSettings> {
  const current = await getSettings();
  return updateSettings({
    lastMigrationAt: new Date().toISOString(),
    totalMigrated: current.totalMigrated + changeCount,
    hasMigratedBefore: true,
  });
}

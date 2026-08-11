import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Local-only persistence for migration backups and app settings.
 * No backend – everything stays on the device.
 */

const BACKUP_KEY = '@9numbers/backups';
const SETTINGS_KEY = '@9numbers/settings';

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
  totalMigrated: number;
  hasMigratedBefore: boolean;
}

const DEFAULT_SETTINGS: AppSettings = {
  lastScanAt: null,
  lastMigrationAt: null,
  totalMigrated: 0,
  hasMigratedBefore: false,
};

export async function getBackups(): Promise<BackupRun[]> {
  try {
    const raw = await AsyncStorage.getItem(BACKUP_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function saveBackup(run: BackupRun): Promise<void> {
  const backups = await getBackups();
  backups.push(run);
  await AsyncStorage.setItem(BACKUP_KEY, JSON.stringify(backups));
}

export async function removeBackup(runId: string): Promise<BackupRun[]> {
  const backups = await getBackups();
  const next = backups.filter(b => b.runId !== runId);
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

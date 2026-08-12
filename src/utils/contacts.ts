/**
 * Lazy-loaded wrapper around `expo-contacts`.
 *
 * IMPORTANT: `expo-contacts` must never be imported at module scope. Its new
 * class-based API runs `class Contact extends expoContactsModule.Contact` at
 * import time; in Expo Go builds that don't ship the `ExpoContactsNext` native
 * module yet, that throws during bundle evaluation and the app dies with a dark
 * screen before anything renders. Loading it here, lazily and inside try/catch,
 * means a missing module shows a friendly alert instead of a dark screen.
 *
 * WHY WE USE `updatePhone` AND NOT `patch({ phones })`
 *
 * `Contact.patch` treats the array it is given as the complete desired state:
 * per the Expo docs, "existing phone numbers will be updated; new phone numbers
 * will be added; NOT PRESENT phone numbers will be DELETED". A dropped row, a
 * number added on another device between our read and our write, or a partial
 * read would therefore silently erase phone numbers from a real address book.
 * `updatePhone` edits exactly one row by id and cannot delete anything, so
 * every write here goes through it.
 */

import { isSameNumber, numberKey } from './migration';

export interface RawContactPhone {
  /** Row id. iOS: CNLabeledValue identifier, Android: Phone._ID. */
  id: string;
  number: string;
  label?: string;
}

export interface RawContact {
  id: string;
  fullName: string | null;
  phones: RawContactPhone[];
}

export interface PhoneUpdate {
  /** Row id of the number to change. Required - we never write blind. */
  phoneId: string;
  /** What we believe is stored right now, used as a safety check. */
  currentNumber: string;
  /** What to store instead. */
  newNumber: string;
}

export interface AppliedChange {
  phoneId: string;
  oldNumber: string;
  newNumber: string;
}

export type SkipCode =
  /** The row no longer exists on the device. */
  | 'missing'
  /** The row exists but holds a different number than we expected. */
  | 'changed'
  /** The row already holds the value we wanted to write. */
  | 'already-applied';

export interface SkippedChange {
  phoneId: string;
  expected: string;
  found: string | null;
  code: SkipCode;
}

export interface UpdateOutcome {
  applied: AppliedChange[];
  skipped: SkippedChange[];
  /** Set when the whole contact failed (permission revoked, write error, ...). */
  error: Error | null;
}

/** What to do with one phone row. Pure, so it can be tested directly. */
export type WritePlan = { action: 'write' } | { action: 'skip'; code: SkipCode };

/**
 * Decides whether one row may be overwritten.
 *
 * Extracted from `updateContactPhones` so the rules can be tested without a
 * device. The two comparisons deliberately use different strictness:
 *
 *  - "is it already at the target" must be STRICT digit equality. `isSameNumber`
 *    treats `7123456` and `877123456` as the same subscriber, which is right for
 *    drift detection but wrong here: during an undo the target value IS the
 *    7-digit form of what is stored, so a loose match would make every restore
 *    conclude it had nothing to do.
 *  - "has it drifted since the scan" must be LOOSE, so a user who reformatted
 *    `877123456` to `+220 877 123 456` in the Contacts app does not get skipped.
 */
export function planPhoneWrite(
  storedNumber: string | undefined | null,
  update: Pick<PhoneUpdate, 'currentNumber' | 'newNumber'>
): WritePlan {
  if (!storedNumber) return { action: 'skip', code: 'missing' };
  if (numberKey(storedNumber) === numberKey(update.newNumber)) {
    return { action: 'skip', code: 'already-applied' };
  }
  if (!isSameNumber(storedNumber, update.currentNumber)) {
    return { action: 'skip', code: 'changed' };
  }
  return { action: 'write' };
}

export class ContactsUnavailableError extends Error {
  constructor() {
    super(
      'The contacts library could not be loaded in this Expo Go version. ' +
        'Please update Expo Go from the Play Store, or use a development build.'
    );
    this.name = 'ContactsUnavailableError';
  }
}

async function loadContacts(): Promise<typeof import('expo-contacts')> {
  try {
    return await import('expo-contacts');
  } catch {
    throw new ContactsUnavailableError();
  }
}

/** Returns true when the user has granted contacts access. */
export async function requestContactsPermission(): Promise<boolean> {
  const mod = await loadContacts();
  const perm = await mod.requestPermissionsAsync();
  return perm.status === 'granted';
}

/** Returns true when access was already granted, without prompting. */
export async function hasContactsPermission(): Promise<boolean> {
  try {
    const mod = await loadContacts();
    const perm = await mod.getPermissionsAsync();
    return perm.status === 'granted';
  } catch {
    return false;
  }
}

/** Reads every contact that has at least one usable phone number. */
export async function getAllContacts(): Promise<RawContact[]> {
  const mod = await loadContacts();
  const details = await mod.Contact.getAllDetails(
    [mod.ContactField.FULL_NAME, mod.ContactField.PHONES],
    { sortOrder: mod.ContactsSortOrder.GivenName }
  );

  return details
    .map(c => ({
      id: c.id,
      fullName: c.fullName,
      phones: (c.phones ?? [])
        // A row we cannot address by id is a row we must not write to.
        .filter(p => !!p.number && !!p.id)
        .map(p => ({ id: p.id, number: p.number as string, label: p.label })),
    }))
    .filter(c => c.phones.length > 0);
}

/**
 * Applies phone-number changes to one contact, one row at a time.
 *
 * The contact is re-read immediately before writing so we only touch rows that
 * still exist and still hold the number we analysed. Anything that moved under
 * us is reported in `skipped` rather than overwritten, and a row that already
 * holds the target value is left alone, which makes a re-run harmless.
 */
export async function updateContactPhones(
  contactId: string,
  updates: PhoneUpdate[]
): Promise<UpdateOutcome> {
  const outcome: UpdateOutcome = { applied: [], skipped: [], error: null };
  if (updates.length === 0) return outcome;

  let mod: typeof import('expo-contacts');
  let contact: import('expo-contacts').Contact;
  let phones: { id: string; number?: string; label?: string }[];

  try {
    mod = await loadContacts();
    contact = new mod.Contact(contactId);
    phones = await contact.getPhones();
  } catch (error) {
    outcome.error = error instanceof Error ? error : new Error(String(error));
    return outcome;
  }

  const byId = new Map(phones.map(p => [p.id, p]));

  for (const update of updates) {
    const row = byId.get(update.phoneId);
    const plan = planPhoneWrite(row?.number, update);

    if (plan.action === 'skip') {
      outcome.skipped.push({
        phoneId: update.phoneId,
        expected: update.currentNumber,
        found: row?.number ?? null,
        code: plan.code,
      });
      continue;
    }

    // `planPhoneWrite` only returns 'write' when the row exists and holds a
    // number, so these are safe.
    const existing = row as { id: string; number: string; label?: string };

    try {
      await contact.updatePhone({ ...existing, number: update.newNumber });
      outcome.applied.push({
        phoneId: existing.id,
        oldNumber: existing.number,
        newNumber: update.newNumber,
      });
    } catch (error) {
      console.error('[9Numbers] failed to update phone', existing.id, error);
      outcome.skipped.push({
        phoneId: update.phoneId,
        expected: update.currentNumber,
        found: existing.number,
        code: 'changed',
      });
    }
  }

  return outcome;
}

/**
 * Lazy-loaded wrapper around `expo-contacts`.
 *
 * IMPORTANT: `expo-contacts` must never be imported at module scope. Its new
 * class-based API runs `class Contact extends expoContactsModule.Contact` at
 * import time; in Expo Go builds that don't ship the `ExpoContactsNext` native
 * module yet, that throws during bundle evaluation and the app dies with a dark
 * screen before anything renders. Loading it here, lazily and inside try/catch,
 * means a missing module shows a friendly alert instead of a dark screen.
 */

export interface RawContactPhone {
  id?: string;
  number: string;
}

export interface RawContact {
  id: string;
  fullName: string | null;
  phones: RawContactPhone[];
}

export interface PhoneUpdate {
  phoneId?: string;
  currentNumber: string;
  newNumber: string;
}

export interface AppliedChange {
  phoneId: string;
  oldNumber: string;
  newNumber: string;
}

export class ContactsUnavailableError extends Error {
  constructor() {
    super(
      'The contacts library could not be loaded in this Expo Go version. ' +
        'Please update Expo Go from the Play Store, or use a development build.'
    );
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

/** Reads every contact that has at least one phone number. */
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
        .filter(p => !!p.number)
        .map(p => ({ id: p.id, number: p.number as string })),
    }))
    .filter(c => c.phones.length > 0);
}

/**
 * Applies phone-number changes to a contact. The contact is re-fetched right
 * before writing, so we only touch rows that actually exist right now and
 * untouched numbers pass through unchanged.
 *
 * Returns the changes that were really applied.
 */
export async function updateContactPhones(
  contactId: string,
  updates: PhoneUpdate[]
): Promise<AppliedChange[]> {
  const mod = await loadContacts();
  const contact = new mod.Contact(contactId);
  const details = await contact.getDetails([mod.ContactField.PHONES]);
  const applied: AppliedChange[] = [];

  const phones = (details.phones ?? []).map(phone => {
    if (!phone.number) return phone;
    const match =
      updates.find(u => u.phoneId && u.phoneId === phone.id) ??
      updates.find(u => u.currentNumber === phone.number);
    if (!match) return phone;
    applied.push({ phoneId: phone.id ?? '', oldNumber: phone.number, newNumber: match.newNumber });
    return { ...phone, number: match.newNumber };
  });

  await contact.patch({ phones });
  return applied;
}

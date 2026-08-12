/**
 * Turns the raw address book into something the review screen can render.
 *
 * Everything the scan decided is kept, not just the numbers we can change. The
 * old version silently discarded anything it could not classify, so a number
 * that genuinely needed a human decision simply vanished and the user was told
 * "all done". Now every verdict is counted, and the ones that need a person are
 * handed back in `attention`.
 */

import { getAllContacts, type RawContact } from './contacts';
import {
  analyzeGambianNumber,
  migrateWithOperator,
  type MigratingOperator,
  type MigrationReason,
  type NumberAnalysis,
  type Operator,
} from './migration';

export interface ScannedNumber {
  phoneId: string;
  label?: string;
  /** Exactly what is stored on the device. */
  original: string;
  analysis: NumberAnalysis;
  /** Included in the next write? */
  selected: boolean;
  /** Set when the user overrode the detected operator by hand. */
  overriddenTo?: MigratingOperator;
}

export interface ScannedContact {
  contactId: string;
  name: string;
  /** Only the numbers that can be migrated. */
  numbers: ScannedNumber[];
}

/** A number we refuse to touch automatically but the user should know about. */
export interface AttentionItem {
  contactId: string;
  contactName: string;
  phoneId: string;
  original: string;
  analysis: NumberAnalysis;
}

export interface ScanSummary {
  /** Contacts that have at least one phone number. */
  contactsScanned: number;
  /** Every phone number looked at. */
  numbersScanned: number;
  /** Contacts with at least one migratable number. */
  contactsToUpdate: number;
  /** Counts per verdict. */
  byReason: Record<MigrationReason, number>;
  /** Counts per operator, for migratable numbers only. */
  byOperator: Partial<Record<Operator, number>>;
}

export interface ScanResult {
  contacts: ScannedContact[];
  attention: AttentionItem[];
  summary: ScanSummary;
}

const EMPTY_REASONS: Record<MigrationReason, number> = {
  'needs-migration': 0,
  'already-migrated': 0,
  'not-migrating': 0,
  'prefix-mismatch': 0,
  'unknown-range': 0,
  foreign: 0,
  invalid: 0,
};

/**
 * Verdicts worth showing the user. `foreign`, `invalid` and `already-migrated`
 * are noise - there is nothing to decide about them.
 */
const NEEDS_A_HUMAN: MigrationReason[] = ['prefix-mismatch', 'unknown-range'];

export function analyzeContacts(raw: RawContact[]): ScanResult {
  const contacts: ScannedContact[] = [];
  const attention: AttentionItem[] = [];
  const summary: ScanSummary = {
    contactsScanned: 0,
    numbersScanned: 0,
    contactsToUpdate: 0,
    byReason: { ...EMPTY_REASONS },
    byOperator: {},
  };

  for (const contact of raw) {
    const name = contact.fullName?.trim() || 'Unnamed contact';
    const numbers: ScannedNumber[] = [];
    summary.contactsScanned++;

    for (const phone of contact.phones) {
      summary.numbersScanned++;
      const analysis = analyzeGambianNumber(phone.number);
      summary.byReason[analysis.reason]++;

      if (analysis.needsMigration) {
        summary.byOperator[analysis.operator] = (summary.byOperator[analysis.operator] ?? 0) + 1;
        numbers.push({
          phoneId: phone.id,
          label: phone.label,
          original: phone.number,
          analysis,
          selected: true,
        });
        continue;
      }

      if (NEEDS_A_HUMAN.includes(analysis.reason)) {
        attention.push({
          contactId: contact.id,
          contactName: name,
          phoneId: phone.id,
          original: phone.number,
          analysis,
        });
      }
    }

    if (numbers.length > 0) {
      summary.contactsToUpdate++;
      contacts.push({ contactId: contact.id, name, numbers });
    }
  }

  return { contacts, attention, summary };
}

/** Reads the address book and classifies every number in it. */
export async function scanContacts(): Promise<ScanResult> {
  return analyzeContacts(await getAllContacts());
}

/** Total number of numbers currently selected for writing. */
export function countSelected(contacts: ScannedContact[]): number {
  return contacts.reduce((n, c) => n + c.numbers.filter(x => x.selected).length, 0);
}

/** Contacts that have at least one selected number. */
export function countSelectedContacts(contacts: ScannedContact[]): number {
  return contacts.filter(c => c.numbers.some(x => x.selected)).length;
}

/**
 * Adds a number we could not place into the list to be written, using an
 * operator the user picked by hand ("I know this is a QCell line").
 *
 * Returns the list unchanged if the number cannot take a prefix, so a bad tap
 * can never produce a nonsense write.
 */
export function assignOperator(
  contacts: ScannedContact[],
  item: AttentionItem,
  operator: MigratingOperator
): ScannedContact[] {
  const analysis = migrateWithOperator(item.original, operator);
  if (!analysis.needsMigration) return contacts;

  const entry: ScannedNumber = {
    phoneId: item.phoneId,
    original: item.original,
    analysis,
    selected: true,
    overriddenTo: operator,
  };

  const existing = contacts.find(c => c.contactId === item.contactId);
  if (!existing) {
    return [...contacts, { contactId: item.contactId, name: item.contactName, numbers: [entry] }];
  }

  return contacts.map(contact =>
    contact.contactId !== item.contactId
      ? contact
      : {
          ...contact,
          numbers: contact.numbers.some(n => n.phoneId === item.phoneId)
            ? contact.numbers.map(n => (n.phoneId === item.phoneId ? entry : n))
            : [...contact.numbers, entry],
        }
  );
}

/** Flips one number in or out of the next write. */
export function toggleNumber(
  contacts: ScannedContact[],
  phoneId: string,
  selected?: boolean
): ScannedContact[] {
  return contacts.map(contact => ({
    ...contact,
    numbers: contact.numbers.map(num =>
      num.phoneId === phoneId ? { ...num, selected: selected ?? !num.selected } : num
    ),
  }));
}

/** Selects or deselects every number in one contact. */
export function toggleContact(
  contacts: ScannedContact[],
  contactId: string,
  selected?: boolean
): ScannedContact[] {
  return contacts.map(contact => {
    if (contact.contactId !== contactId) return contact;
    const next = selected ?? !contact.numbers.every(n => n.selected);
    return { ...contact, numbers: contact.numbers.map(n => ({ ...n, selected: next })) };
  });
}

/**
 * Selects or deselects a specific set of contacts.
 *
 * The caller passes the ids that are currently VISIBLE, so "select all" applies
 * to what the user can actually see. The old version always toggled every
 * contact in the scan, which meant tapping "select all" while a search filter
 * was active quietly queued up hundreds of unseen contacts.
 */
export function setSelectionFor(
  contacts: ScannedContact[],
  contactIds: Set<string>,
  selected: boolean
): ScannedContact[] {
  return contacts.map(contact =>
    contactIds.has(contact.contactId)
      ? { ...contact, numbers: contact.numbers.map(n => ({ ...n, selected })) }
      : contact
  );
}

/** Flattens the current selection into the shape the runner wants. */
export function selectedTargets(contacts: ScannedContact[]) {
  return contacts.flatMap(contact =>
    contact.numbers
      .filter(num => num.selected && num.analysis.write)
      .map(num => ({
        contactId: contact.contactId,
        contactName: contact.name,
        phoneId: num.phoneId,
        analysis: num.analysis,
      }))
  );
}

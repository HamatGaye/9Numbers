import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import {
  Button,
  Card,
  Check,
  Display,
  Divider,
  Eyebrow,
  IconButton,
  Micro,
  Muted,
  NumberDiff,
  OperatorTag,
  Pill,
  Row,
  Screen,
  Sheet,
  Title,
  Well,
} from '@/components/ui';
import { operatorStyle } from '@/constants/operators';
import {
  canChooseOperator,
  explainReason,
  MIGRATING_OPERATORS,
  numberKey,
  OPERATOR_PREFIXES,
  prettyPrint,
  type MigratingOperator,
  type Operator,
} from '@/utils/migration';
import {
  countSelected,
  countSelectedContacts,
  type AttentionItem,
  type ScanResult,
  type ScannedContact,
} from '@/utils/scan';

interface Props {
  result: ScanResult;
  onToggleNumber: (phoneId: string) => void;
  onToggleContact: (contactId: string) => void;
  onSetVisibleSelection: (contactIds: Set<string>, selected: boolean) => void;
  onAssignOperator: (item: AttentionItem, operator: MigratingOperator) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

type Filter = 'all' | Operator;

/**
 * Where the user decides what happens.
 *
 * Selection is per NUMBER, not per contact, because a contact can hold a mobile
 * and a landline and only one of them should change. Numbers we could not place
 * are surfaced in a Sheet instead of being silently dropped, so "nothing to do"
 * always means exactly that.
 */
export function ReviewScreen({
  result,
  onToggleNumber,
  onToggleContact,
  onSetVisibleSelection,
  onAssignOperator,
  onConfirm,
  onCancel,
}: Props) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [searching, setSearching] = useState(false);
  const [attentionOpen, setAttentionOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const { contacts, attention } = result;
  const selectedNumbers = countSelected(contacts);
  const selectedContacts = countSelectedContacts(contacts);
  const totalNumbers = contacts.reduce((n, c) => n + c.numbers.length, 0);

  const operatorCounts = useMemo(() => {
    const counts = new Map<Operator, number>();
    for (const contact of contacts) {
      for (const num of contact.numbers) {
        counts.set(num.analysis.operator, (counts.get(num.analysis.operator) ?? 0) + 1);
      }
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [contacts]);

  /** Matches the name, the number as typed, and its bare digits. */
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const digits = q.replace(/\D/g, '');

    return contacts
      .map(c => ({ ...c, numbers: c.numbers.filter(n => filter === 'all' || n.analysis.operator === filter) }))
      .filter(c => c.numbers.length > 0)
      .filter(c => {
        if (!q) return true;
        if (c.name.toLowerCase().includes(q)) return true;
        return c.numbers.some(
          n =>
            n.original.toLowerCase().includes(q) ||
            (!!digits &&
              (numberKey(n.original).includes(digits) ||
                (n.analysis.national9 ?? '').includes(digits)))
        );
      });
  }, [contacts, filter, query]);

  const visibleIds = useMemo(() => new Set(visible.map(c => c.contactId)), [visible]);
  const visibleNumbers = visible.flatMap(c => c.numbers);
  const allVisibleOn = visibleNumbers.length > 0 && visibleNumbers.every(n => n.selected);

  return (
    <Screen>
      {/* Header */}
      <View className="px-5 pt-2 pb-3">
        <Row>
          <IconButton glyph="←" onPress={onCancel} label="Back" />
          <View className="flex-1 ml-3">
            <Title>Review</Title>
          </View>
          {searching ? null : (
            <IconButton glyph="⌕" onPress={() => setSearching(true)} label="Search" />
          )}
        </Row>

        {searching && (
          <Row className="mt-3 bg-paper-sunken dark:bg-night-sunken rounded-2xl px-4">
            <TextInput
              value={query}
              onChangeText={setQuery}
              autoFocus
              placeholder="Name or number"
              placeholderTextColor="#8B93A1"
              accessibilityLabel="Search contacts"
              className="flex-1 py-3 text-ink dark:text-chalk text-[15px]"
            />
            <Pressable
              onPress={() => {
                setQuery('');
                setSearching(false);
              }}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Close search"
              className="active:opacity-60">
              <Text className="text-ink-soft dark:text-chalk-soft">✕</Text>
            </Pressable>
          </Row>
        )}
      </View>

      {/* Filters */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerClassName="px-5 gap-2 pb-3">
        <Pill label={`All ${totalNumbers}`} active={filter === 'all'} onPress={() => setFilter('all')} />
        {operatorCounts.map(([operator, count]) => (
          <Pill
            key={operator}
            label={`${operatorStyle(operator).label} ${count}`}
            dot={filter === operator ? 'bg-blue-ink' : operatorStyle(operator).bg}
            active={filter === operator}
            onPress={() => setFilter(operator)}
          />
        ))}
      </ScrollView>

      {/* Select-all bar */}
      <Row className="px-5 pb-2">
        <Check
          checked={allVisibleOn}
          onPress={() => onSetVisibleSelection(visibleIds, !allVisibleOn)}
          label={allVisibleOn ? 'Deselect all shown' : 'Select all shown'}
        />
        <Pressable
          onPress={() => onSetVisibleSelection(visibleIds, !allVisibleOn)}
          accessibilityRole="button"
          className="flex-1 ml-3 active:opacity-60">
          <Eyebrow>{allVisibleOn ? 'None' : 'Select all'}</Eyebrow>
        </Pressable>
        <Micro>{selectedNumbers} of {totalNumbers}</Micro>
      </Row>

      <ScrollView className="flex-1 px-5" keyboardShouldPersistTaps="handled">
        {attention.length > 0 && (
          <Pressable
            onPress={() => setAttentionOpen(true)}
            accessibilityRole="button"
            className="mb-3 active:opacity-70">
            <Well className="p-4 flex-row items-center">
              <Text className="text-warn font-bold text-xs w-6">{attention.length}</Text>
              <Micro className="flex-1">not recognised — skipped</Micro>
              <Text className="text-ink-soft dark:text-chalk-soft text-xs">›</Text>
            </Well>
          </Pressable>
        )}

        {visible.length === 0 ? (
          <Muted className="text-center mt-16">Nothing here</Muted>
        ) : (
          visible.map(contact => (
            <ContactCard
              key={contact.contactId}
              contact={contact}
              onToggleNumber={onToggleNumber}
              onToggleContact={onToggleContact}
            />
          ))
        )}

        <View className="h-4" />
      </ScrollView>

      {/* Action bar */}
      <View className="px-5 pt-3 pb-2 border-t border-paper-line dark:border-night-line">
        <Button
          label={selectedNumbers === 0 ? 'Select a number' : `Update ${selectedNumbers}`}
          disabled={selectedNumbers === 0}
          onPress={() => setConfirmOpen(true)}
        />
      </View>

      {/* Confirm step - keeps the reassurance off the main screen */}
      <Sheet visible={confirmOpen} onClose={() => setConfirmOpen(false)} title="Confirm">
        <Card className="p-5 items-center">
          <Display>{selectedNumbers}</Display>
          <Micro className="mt-1">
            number{selectedNumbers === 1 ? '' : 's'} in {selectedContacts} contact
            {selectedContacts === 1 ? '' : 's'}
          </Micro>
        </Card>
        <Well className="mt-3 p-4">
          <Row>
            <Text className="text-good mr-3">✓</Text>
            <Micro className="flex-1">A backup is saved — you can undo this</Micro>
          </Row>
          <Row className="mt-2">
            <Text className="text-good mr-3">✓</Text>
            <Micro className="flex-1">Nothing is uploaded</Micro>
          </Row>
        </Well>
        <Button
          label="Update contacts"
          className="mt-4"
          onPress={() => {
            setConfirmOpen(false);
            onConfirm();
          }}
        />
        <Button label="Cancel" tone="ghost" onPress={() => setConfirmOpen(false)} className="mt-1" />
      </Sheet>

      {/* Unrecognised numbers */}
      <Sheet
        visible={attentionOpen}
        onClose={() => setAttentionOpen(false)}
        title="Not recognised">
        <Muted className="mb-4">These are left as they are. Pick a network to add its prefix.</Muted>
        {attention.map(item => (
          <AttentionRow key={item.phoneId} item={item} onAssign={onAssignOperator} />
        ))}
      </Sheet>
    </Screen>
  );
}

/**
 * Marks a number sitting in a block that used to hold Gamtel landlines. PURA's
 * notice puts these blocks with migrating operators, so they are selected like
 * any other — this is just a nudge to glance before committing.
 */
function FixedLineFlag() {
  return (
    <View className="px-1.5 py-0.5 rounded-md bg-warn/15 ml-2">
      <Text className="text-warn text-[9px] font-bold uppercase tracking-wider">check</Text>
    </View>
  );
}

function ContactCard({
  contact,
  onToggleNumber,
  onToggleContact,
}: {
  contact: ScannedContact;
  onToggleNumber: (phoneId: string) => void;
  onToggleContact: (contactId: string) => void;
}) {
  const selected = contact.numbers.filter(n => n.selected).length;
  const all = selected === contact.numbers.length;
  const single = contact.numbers.length === 1;

  return (
    <Card className="mb-2.5 px-4 py-3.5">
      <Row
        onPress={() => (single ? onToggleNumber(contact.numbers[0].phoneId) : onToggleContact(contact.contactId))}>
        <Check
          checked={all}
          mixed={selected > 0 && !all}
          onPress={() =>
            single ? onToggleNumber(contact.numbers[0].phoneId) : onToggleContact(contact.contactId)
          }
          label={`Select ${contact.name}`}
        />
        <View className="flex-1 ml-3">
          <Text
            className="text-ink dark:text-chalk text-[15px] font-semibold"
            numberOfLines={1}>
            {contact.name}
          </Text>
          {single && (
            <View className="mt-1">
              <NumberDiff
                before={prettyPrint(contact.numbers[0].analysis.legacyDigits ?? '')}
                prefix={OPERATOR_PREFIXES[contact.numbers[0].analysis.operator as MigratingOperator] ?? ''}
                rest={prettyPrint(contact.numbers[0].analysis.national9 ?? '').slice(2)}
              />
            </View>
          )}
        </View>
        {single && (
          <Row>
            <OperatorTag operator={contact.numbers[0].analysis.operator} />
            {contact.numbers[0].analysis.mayBeFixedLine && <FixedLineFlag />}
          </Row>
        )}
      </Row>

      {/* Multiple numbers get their own rows so each can be picked separately. */}
      {!single &&
        contact.numbers.map((num, i) => (
          <View key={num.phoneId}>
            {i === 0 && <Divider className="mt-3" />}
            <Row onPress={() => onToggleNumber(num.phoneId)} className="py-3">
              <View className="w-[22px] items-center">
                <Check
                  checked={num.selected}
                  onPress={() => onToggleNumber(num.phoneId)}
                  label={`Update ${num.original}`}
                />
              </View>
              <View className="flex-1 ml-3">
                <NumberDiff
                  before={prettyPrint(num.analysis.legacyDigits ?? '')}
                  prefix={OPERATOR_PREFIXES[num.analysis.operator as MigratingOperator] ?? ''}
                  rest={prettyPrint(num.analysis.national9 ?? '').slice(2)}
                />
              </View>
              <Row>
                <OperatorTag operator={num.analysis.operator} />
                {num.analysis.mayBeFixedLine && <FixedLineFlag />}
              </Row>
            </Row>
            {i < contact.numbers.length - 1 && <Divider />}
          </View>
        ))}
    </Card>
  );
}

/**
 * One unplaceable number. The network buttons only appear for 7-digit numbers,
 * because those are the only ones where a missing prefix is the actual problem.
 */
function AttentionRow({
  item,
  onAssign,
}: {
  item: AttentionItem;
  onAssign: (item: AttentionItem, operator: MigratingOperator) => void;
}) {
  const choosable = canChooseOperator(item.original);

  return (
    <Card className="mb-2 px-4 py-3.5">
      <Text className="text-ink dark:text-chalk text-[15px] font-semibold" numberOfLines={1}>
        {item.contactName}
      </Text>
      <Row className="mt-0.5">
        <Text className="font-mono text-ink-soft dark:text-chalk-soft text-[13px]">
          {item.original}
        </Text>
      </Row>
      <Micro className="mt-1">{explainReason(item.analysis)}</Micro>

      {choosable && (
        <Row className="mt-3 gap-2">
          {MIGRATING_OPERATORS.map(operator => (
            <Pressable
              key={operator}
              onPress={() => onAssign(item, operator)}
              accessibilityRole="button"
              className="flex-1 py-2.5 rounded-xl bg-paper-sunken dark:bg-night-sunken active:opacity-60">
              <Text className="text-ink dark:text-chalk text-[11px] font-bold text-center">
                {operator}
              </Text>
              <Text className="font-mono text-blue-deep dark:text-blue text-[11px] font-bold text-center">
                {OPERATOR_PREFIXES[operator]}
              </Text>
            </Pressable>
          ))}
        </Row>
      )}
    </Card>
  );
}

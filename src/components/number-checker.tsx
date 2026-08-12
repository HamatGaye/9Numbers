import { useMemo, useState } from 'react';
import { Text, TextInput, View } from 'react-native';

import { Micro, NumberDiff, OperatorTag, Sheet, Well } from '@/components/ui';
import {
  analyzeGambianNumber,
  explainReason,
  OPERATOR_PREFIXES,
  prettyPrint,
  type MigratingOperator,
} from '@/utils/migration';

/**
 * "What is my new number?" — answered in one field, with no contacts access.
 *
 * Lives in a Sheet so the home screen does not have to carry it. The result is
 * the whole explanation: struck-through old number, blue prefix, new number.
 */
export function NumberCheckerSheet({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const [input, setInput] = useState('');
  const trimmed = input.trim();
  const analysis = useMemo(() => (trimmed ? analyzeGambianNumber(trimmed) : null), [trimmed]);
  const prefix = analysis?.needsMigration
    ? OPERATOR_PREFIXES[analysis.operator as MigratingOperator]
    : '';

  return (
    <Sheet
      visible={visible}
      onClose={() => {
        setInput('');
        onClose();
      }}
      title="Check a number">
      <View className="flex-row items-center bg-paper-sunken dark:bg-night-sunken rounded-2xl px-4">
        <Text className="font-mono text-ink-soft dark:text-chalk-soft text-base mr-2">+220</Text>
        <TextInput
          value={input}
          onChangeText={setInput}
          keyboardType="phone-pad"
          autoFocus
          placeholder="712 3456"
          placeholderTextColor="#8B93A1"
          accessibilityLabel="Phone number"
          className="flex-1 py-4 font-mono text-ink dark:text-chalk text-xl"
        />
      </View>

      {analysis && (
        <Well className="mt-3 p-5 items-center">
          {analysis.needsMigration ? (
            <>
              <OperatorTag operator={analysis.operator} />
              <View className="mt-3">
                <NumberDiff
                  size="lg"
                  before={prettyPrint(analysis.legacyDigits ?? '')}
                  prefix={prefix}
                  rest={prettyPrint(analysis.national9 ?? '').slice(prefix.length)}
                />
              </View>
              <Micro className="mt-3 font-mono">{analysis.e164}</Micro>
            </>
          ) : (
            <>
              <Text className="font-display text-ink dark:text-chalk text-xl">
                {analysis.reason === 'already-migrated' ? 'Already updated' : 'No change'}
              </Text>
              <Micro className="mt-1.5 text-center">{explainReason(analysis)}</Micro>
            </>
          )}
        </Well>
      )}
    </Sheet>
  );
}

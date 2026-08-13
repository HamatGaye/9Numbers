import { useEffect, useMemo, useState } from 'react';
import {
  BackHandler,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';

import { IconButton, Micro, NumberDiff, OperatorTag, Title, Well } from '@/components/ui';
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
 * A full-screen overlay rather than a bottom sheet: the field sits at the top
 * of the screen, so no keyboard can ever cover it, and the result appears
 * beneath it. The result is the whole explanation: struck-through old number,
 * blue prefix, new number.
 */
export function NumberCheckerSheet({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const [input, setInput] = useState('');
  const { height } = useWindowDimensions();
  const trimmed = input.trim();
  const analysis = useMemo(() => (trimmed ? analyzeGambianNumber(trimmed) : null), [trimmed]);
  const prefix = analysis?.needsMigration
    ? OPERATOR_PREFIXES[analysis.operator as MigratingOperator]
    : '';

  const close = () => {
    setInput('');
    onClose();
  };

  useEffect(() => {
    if (!visible) {
      return;
    }
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      close();
      return true;
    });
    return () => sub.remove();
  }, [visible, onClose]);

  if (!visible) {
    return null;
  }

  return (
    <View className="absolute inset-0 z-50 bg-paper dark:bg-night">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1">
        <ScrollView
          className="flex-1 px-5"
          contentContainerClassName="pb-10"
          keyboardShouldPersistTaps="handled">
          {/* Rests just above the middle of the screen so the keypad, which
              claims the bottom half, can never reach it. */}
          <View style={{ height: Math.max(160, Math.round(height * 0.34)) }} />
          <View className="flex-row items-center mb-3">
            <IconButton glyph="✕" onPress={close} label="Close" />
            <Title className="ml-3">Check a number</Title>
          </View>
          <View className="flex-row items-center bg-paper-sunken dark:bg-night-sunken rounded-2xl px-4">
            <Text className="font-mono text-ink-soft dark:text-chalk-soft text-base mr-2">
              +220
            </Text>
            <TextInput
              value={input}
              onChangeText={setInput}
              keyboardType="phone-pad"
              placeholder="712 3456"
              placeholderTextColor="#8B93A1"
              accessibilityLabel="Phone number"
              className="flex-1 py-4 font-mono text-ink dark:text-chalk text-xl"
            />
          </View>

          {!trimmed && (
            <Micro className="mt-3 text-center">
              Type any Gambian number — 7 or 9 digits — and its new form appears here.
            </Micro>
          )}

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
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
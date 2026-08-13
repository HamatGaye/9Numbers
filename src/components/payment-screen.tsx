import { ActivityIndicator, Text, View } from 'react-native';

import { Button, Card, Display, Micro, Muted, Row, Screen, Title, Well } from '@/components/ui';

export type PaymentPhase = 'ask' | 'starting' | 'checking' | 'error' | 'unavailable';

/**
 * The pay gate: D25 for a one-time unlock. Shown only when no valid license
 * is stored. The amount comes from the server so a price change needs no app
 * update.
 */
export function PaymentScreen({
  phase,
  amountGmd,
  error,
  onPay,
  onRecheck,
  onCancel,
}: {
  phase: PaymentPhase;
  amountGmd: string | null;
  error: string | null;
  onPay: () => void;
  onRecheck: () => void;
  onCancel: () => void;
}) {
  const price = amountGmd ?? '—';

  return (
    <Screen center className="px-6">
      <View className="items-center">
        <View className="w-14 h-14 rounded-2xl items-center justify-center mb-5 bg-paper-sunken dark:bg-night-sunken">
          <Text className="text-2xl">💳</Text>
        </View>
        <Title className="text-center">One-time unlock</Title>
        <Muted className="text-center mt-2">
          {phase === 'checking' ? 'Confirming payment…' : 'Update your contacts after paying once.'}
        </Muted>
      </View>

      {phase === 'ask' && (
        <>
          <Card className="mt-7 w-full p-5 items-center">
            <Display>D{price}</Display>
            <Micro className="mt-1">per device, forever</Micro>
          </Card>
          <Well className="mt-3 w-full p-4">
            <Row>
              <Text className="text-good mr-3">✓</Text>
              <Micro className="flex-1">Wave, QMoney, AfriMoney or card</Micro>
            </Row>
            <Row className="mt-2">
              <Text className="text-good mr-3">✓</Text>
              <Micro className="flex-1">Paid once — all future updates included</Micro>
            </Row>
          </Well>
          <Button label={`Pay D${price}`} onPress={onPay} className="mt-4 w-full" />
          <Button label="Not now" tone="ghost" onPress={onCancel} className="mt-1 w-full" />
        </>
      )}

      {(phase === 'starting' || phase === 'checking') && (
        <View className="mt-8 w-full items-center">
          <ActivityIndicator size="large" color="#2F7DF6" />
          <Muted className="mt-4 text-center">
            {phase === 'starting'
              ? 'Opening the payment page…'
              : 'Waiting for the payment to confirm. It can take a minute for mobile money.'}
          </Muted>
          {phase === 'checking' && (
            <Button label="I've paid — check again" tone="quiet" onPress={onRecheck} className="mt-6 w-full" />
          )}
        </View>
      )}

      {(phase === 'error' || phase === 'unavailable') && (
        <>
          <Well className="mt-7 w-full p-4 items-center">
            <Text className="text-bad font-bold text-sm">Payment didn't go through</Text>
            <Micro className="mt-1.5 text-center">{error ?? 'Please try again.'}</Micro>
          </Well>
          <Button label="Try again" onPress={onPay} className="mt-4 w-full" />
          <Button label="Check again" tone="quiet" onPress={onRecheck} className="mt-1 w-full" />
          <Button label="Not now" tone="ghost" onPress={onCancel} className="mt-1 w-full" />
        </>
      )}

      {phase === 'checking' && (
        <Muted className="mt-6 text-center">
          You can leave and come back — your payment will still be confirmed.
        </Muted>
      )}
    </Screen>
  );
}
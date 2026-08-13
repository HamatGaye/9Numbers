/**
 * In-app alerts — the replacement for the native `Alert.alert` dialogs.
 *
 * A single provider renders one alert at a time (newest wins). The API mirrors
 * the native one so call sites read the same way, but the look belongs to this
 * design system: a centred card, a serif title, a muted message, and stacked
 * full-width buttons with a destructive red for anything that deletes.
 *
 * Usage: render <AlertProvider /> once near the root, then
 *
 *   import { alert } from '@/components/alert';
 *   alert('Delete this backup?', 'Your numbers stay as they are.', [
 *     { text: 'Cancel', style: 'cancel' },
 *     { text: 'Delete', style: 'destructive', onPress: doIt },
 *   ]);
 */

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Modal, Pressable, Text, View } from 'react-native';

import { Muted, Title } from '@/components/ui';

export interface AlertButton {
  text: string;
  style?: 'default' | 'cancel' | 'destructive';
  onPress?: () => void;
}

interface AlertRequest {
  title: string;
  message?: string;
  buttons: AlertButton[];
}

type Listener = (request: AlertRequest) => void;

let listener: Listener | null = null;

/** Shows an in-app alert. Provider must be mounted; otherwise the call is a no-op. */
export function alert(title: string, message?: string, buttons?: AlertButton[]): void {
  listener?.({
    title,
    message,
    buttons: buttons && buttons.length > 0 ? buttons : [{ text: 'OK' }],
  });
}

const BUTTON_TONES: Record<NonNullable<AlertButton['style']>, string> = {
  default: 'bg-blue',
  cancel:
    'bg-paper-sunken dark:bg-night-sunken border border-paper-line dark:border-night-line',
  destructive: 'bg-brand-red',
};

const BUTTON_TEXT: Record<NonNullable<AlertButton['style']>, string> = {
  default: 'text-blue-ink',
  cancel: 'text-ink dark:text-chalk',
  destructive: 'text-white',
};

function AlertButtonView({
  button,
  onPress,
}: {
  button: AlertButton;
  onPress: () => void;
}) {
  const style = button.style ?? 'default';
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ disabled: false }}
      className={`py-3.5 px-4 rounded-2xl active:opacity-60 ${BUTTON_TONES[style]}`}>
      <Text className={`text-center text-[15px] font-bold ${BUTTON_TEXT[style]}`}>
        {button.text}
      </Text>
    </Pressable>
  );
}

export function AlertProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<AlertRequest | null>(null);
  const scale = useRef(new Animated.Value(0.92)).current;
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    listener = setRequest;
    return () => {
      listener = null;
    };
  }, []);

  useEffect(() => {
    if (!request) return;
    scale.setValue(0.92);
    fade.setValue(0);
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 16, bounciness: 4 }),
      Animated.timing(fade, { toValue: 1, duration: 120, useNativeDriver: true }),
    ]).start();
  }, [request, scale, fade]);

  const dismiss = () => setRequest(null);

  /** Backdrop tap and hardware back follow the cancel button, then nothing else. */
  const dismissLikeCancel = () => {
    const cancel = request?.buttons.find(b => b.style === 'cancel');
    if (cancel) {
      setRequest(null);
      cancel.onPress?.();
      return;
    }
    // Without a cancel button, an empty-tap or back simply closes the alert.
    if (request && request.buttons.length <= 1) {
      setRequest(null);
      request.buttons[0].onPress?.();
    } else {
      setRequest(null);
    }
  };

  const commit = (button: AlertButton) => () => {
    setRequest(null);
    button.onPress?.();
  };

  return (
    <>
      {children}
      <Modal
        visible={!!request}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={dismissLikeCancel}>
        {request && (
          <View className="flex-1 items-center justify-center bg-black/50 px-8">
            <Pressable
              className="absolute inset-0"
              accessibilityRole="button"
              accessibilityLabel="Dismiss"
              onPress={dismissLikeCancel}
            />
            <Animated.View
              style={{ opacity: fade, transform: [{ scale }] }}
              className="w-full max-w-sm bg-paper dark:bg-night rounded-3xl border border-paper-line dark:border-night-line px-5 py-6">
              <Title className="text-center">{request.title}</Title>
              {request.message ? (
                <Muted className="mt-2 text-center">{request.message}</Muted>
              ) : null}
              <View className="mt-5 gap-2">
                {request.buttons.map((button, i) => (
                  <AlertButtonView key={`${button.text}-${i}`} button={button} onPress={commit(button)} />
                ))}
              </View>
            </Animated.View>
          </View>
        )}
      </Modal>
    </>
  );
}
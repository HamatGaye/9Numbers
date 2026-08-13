import React from 'react';
import { Pressable, Text, View } from 'react-native';

interface Props {
  children: React.ReactNode;
}

interface State {
  error: Error | null;
}

const FLAG_STRIPES = ['bg-brand-red', 'bg-white', 'bg-brand-blue', 'bg-white', 'bg-brand-green'];

/**
 * Catches render errors anywhere in the app and shows a branded error screen
 * instead of a blank/dark screen. This makes unexpected failures visible and
 * recoverable instead of silently killing the UI.
 */
export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error('[7To9] ErrorBoundary caught:', error);
  }

  private retry = () => {
    this.setState({ error: null });
  };

  render() {
    if (this.state.error) {
      return (
        <View className="flex-1 bg-brand-cream dark:bg-slate-950 items-center justify-center p-6">
          <View className="h-2 w-24 rounded-full overflow-hidden flex-row mb-4">
            {FLAG_STRIPES.map((stripe, i) => (
              <View key={i} className={`${stripe} flex-1`} />
            ))}
          </View>
          <Text className="text-brand-ink dark:text-white text-2xl font-extrabold text-center mb-2">
            Something went wrong
          </Text>
          <Text className="text-slate-500 dark:text-slate-400 text-sm text-center mb-6 px-6">
            {this.state.error.message || 'An unexpected error occurred.'}
          </Text>
          <Pressable
            onPress={this.retry}
            className="bg-brand-red py-3 px-8 rounded-2xl active:opacity-80">
            <Text className="text-white font-bold">Try again</Text>
          </Pressable>
        </View>
      );
    }
    return this.props.children;
  }
}

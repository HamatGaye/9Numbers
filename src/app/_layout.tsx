import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'react-native';

import '../global.css';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { AlertProvider } from '@/components/alert';
import AppTabs from '@/components/app-tabs';
import { ErrorBoundary } from '@/components/error-boundary';

SplashScreen.preventAutoHideAsync();

export default function TabLayout() {
  const colorScheme = useColorScheme();
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <ErrorBoundary>
        <AnimatedSplashOverlay />
        <AlertProvider>
          <AppTabs />
        </AlertProvider>
      </ErrorBoundary>
      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
    </ThemeProvider>
  );
}

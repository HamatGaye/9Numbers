import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { Platform, useColorScheme } from 'react-native';

import { Colors } from '@/constants/theme';

/**
 * The tab bar.
 *
 * Three things changed from the default:
 *
 *  - **Real vector symbols.** It used to ship three flat PNGs, which look soft
 *    on high-density screens and cannot change with selection state. SF Symbols
 *    on iOS and Material symbols on Android are crisp at any size and give a
 *    filled variant when a tab is active, which is the standard cue on both
 *    platforms.
 *  - **Gold selection.** The accent now matches the app instead of leaving the
 *    system blue tint against a blue-accented UI.
 *  - **A translucent bar on iOS**, so content scrolls under it, plus
 *    `minimizeBehavior` so the bar shrinks out of the way while scrolling on
 *    iOS 26. On Android the bar stays opaque and picks up a tinted indicator,
 *    which is the Material 3 convention.
 *
 * `backgroundColor` is deliberately NOT set on iOS: setting it defeats
 * `blurEffect` and produces a flat, opaque bar.
 */
export default function AppTabs() {
  const scheme = useColorScheme();
  const dark = scheme === 'dark';
  const colors = Colors[dark ? 'dark' : 'light'];

  return (
    <NativeTabs
      backgroundColor={Platform.OS === 'android' ? colors.background : undefined}
      blurEffect={dark ? 'systemChromeMaterialDark' : 'systemChromeMaterialLight'}
      minimizeBehavior="onScrollDown"
      iconColor={{ default: colors.textSecondary, selected: colors.accent }}
      indicatorColor={colors.backgroundSelected}
      rippleColor={colors.backgroundSelected}
      labelStyle={{
        default: { color: colors.textSecondary, fontSize: 11, fontWeight: '600' },
        selected: { color: colors.accent, fontSize: 11, fontWeight: '700' },
      }}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Update</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: 'person.crop.circle', selected: 'person.crop.circle.fill' }}
          md={{ default: 'contacts', selected: 'contacts' }}
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="backups">
        <NativeTabs.Trigger.Label>Backups</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: 'clock.arrow.circlepath', selected: 'clock.arrow.circlepath' }}
          md={{ default: 'history', selected: 'history' }}
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="info">
        <NativeTabs.Trigger.Label>Guide</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: 'info.circle', selected: 'info.circle.fill' }}
          md={{ default: 'info', selected: 'info' }}
        />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}

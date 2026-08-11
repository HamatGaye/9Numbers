import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { useColorScheme } from 'react-native';

import { Colors } from '@/constants/theme';

export default function AppTabs() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'unspecified' ? 'light' : scheme];

  return (
    <NativeTabs
      backgroundColor={colors.background}
      indicatorColor={colors.backgroundElement}
      labelStyle={{ selected: { color: colors.text } }}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Migrate</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf="phone.fill"
          src={require('@/assets/images/tabIcons/migrate.png')}
          renderingMode="template"
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="backups">
        <NativeTabs.Trigger.Label>Backups</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf="clock.arrow.circlepath"
          src={require('@/assets/images/tabIcons/history.png')}
          renderingMode="template"
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="info">
        <NativeTabs.Trigger.Label>Guide</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf="info.circle.fill"
          src={require('@/assets/images/tabIcons/info.png')}
          renderingMode="template"
        />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}

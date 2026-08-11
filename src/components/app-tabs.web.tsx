import {
  Tabs,
  TabList,
  TabTrigger,
  TabSlot,
  TabTriggerSlotProps,
  TabListProps,
} from 'expo-router/ui';
import { Pressable, useColorScheme, View, StyleSheet, Text } from 'react-native';

import { Colors, MaxContentWidth, Spacing } from '@/constants/theme';

export default function AppTabs() {
  return (
    <Tabs>
      <TabSlot style={{ height: '100%' }} />
      <TabList asChild>
        <CustomTabList>
          <TabTrigger name="home" href="/" asChild>
            <TabButton>Migrate</TabButton>
          </TabTrigger>
          <TabTrigger name="backups" href="/backups" asChild>
            <TabButton>Backups</TabButton>
          </TabTrigger>
          <TabTrigger name="info" href="/info" asChild>
            <TabButton>Guide</TabButton>
          </TabTrigger>
        </CustomTabList>
      </TabList>
    </Tabs>
  );
}

export function TabButton({ children, isFocused, ...props }: TabTriggerSlotProps) {
  return (
    <Pressable {...props} style={({ pressed }) => pressed && styles.pressed}>
      <View
        style={[
          styles.tabButtonView,
          isFocused ? styles.tabButtonFocused : styles.tabButtonIdle,
        ]}>
        <Text style={isFocused ? styles.tabLabelFocused : styles.tabLabelIdle}>{children}</Text>
      </View>
    </Pressable>
  );
}

export function CustomTabList(props: TabListProps) {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'unspecified' ? 'light' : scheme];

  return (
    <View {...props} style={styles.tabListContainer}>
      <View
        style={[styles.innerContainer, { backgroundColor: colors.backgroundElement }]}>
        <Text style={[styles.brandText, { color: colors.text }]}>9Numbers</Text>

        {props.children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tabListContainer: {
    position: 'absolute',
    width: '100%',
    padding: Spacing.three,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  innerContainer: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.five,
    borderRadius: Spacing.five,
    flexDirection: 'row',
    alignItems: 'center',
    flexGrow: 1,
    gap: Spacing.two,
    maxWidth: MaxContentWidth,
  },
  brandText: {
    marginRight: 'auto',
    fontWeight: '800',
    fontSize: 16,
  },
  pressed: {
    opacity: 0.7,
  },
  tabButtonView: {
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three,
  },
  tabButtonFocused: {
    backgroundColor: '#C8102E',
  },
  tabButtonIdle: {
    backgroundColor: 'transparent',
  },
  tabLabelFocused: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 14,
  },
  tabLabelIdle: {
    color: '#64748b',
    fontWeight: '500',
    fontSize: 14,
  },
});

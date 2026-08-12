import {
  TabList,
  TabSlot,
  TabTrigger,
  Tabs,
  type TabListProps,
  type TabTriggerSlotProps,
} from 'expo-router/ui';
import { Pressable, StyleSheet, Text, useColorScheme, View } from 'react-native';

import { Colors, MaxContentWidth, Spacing } from '@/constants/theme';

/**
 * Web tab bar: a floating pill, matching the gold accent used on native.
 *
 * It previously highlighted the active tab in the old brand red and pointed at a
 * route named `home`, while the native tabs use `index` — so the first tab never
 * matched. Both are fixed here.
 */
export default function AppTabs() {
  return (
    <Tabs>
      <TabSlot style={styles.slot} />
      <TabList asChild>
        <CustomTabList>
          <TabTrigger name="index" href="/" asChild>
            <TabButton>Update</TabButton>
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
    <Pressable {...props} style={({ pressed }) => (pressed ? styles.pressed : undefined)}>
      <View style={[styles.tab, isFocused && styles.tabFocused]}>
        <Text style={isFocused ? styles.labelFocused : styles.label}>{children}</Text>
      </View>
    </Pressable>
  );
}

export function CustomTabList(props: TabListProps) {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

  return (
    <View {...props} style={styles.bar}>
      <View
        style={[
          styles.inner,
          { backgroundColor: colors.backgroundElement, borderColor: colors.backgroundSelected },
        ]}>
        <Text style={[styles.brand, { color: colors.text }]}>9Numbers</Text>
        {props.children}
      </View>
    </View>
  );
}

const GOLD = '#E3A83C';
const GOLD_INK = '#20180A';

const styles = StyleSheet.create({
  slot: { height: '100%' },
  bar: {
    position: 'absolute',
    width: '100%',
    padding: Spacing.three,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  inner: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.four,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    flexGrow: 1,
    gap: Spacing.two,
    maxWidth: MaxContentWidth,
  },
  brand: {
    marginRight: 'auto',
    fontWeight: '700',
    fontSize: 15,
  },
  pressed: { opacity: 0.7 },
  tab: {
    paddingVertical: 6,
    paddingHorizontal: Spacing.three,
    borderRadius: 999,
  },
  tabFocused: { backgroundColor: GOLD },
  label: { color: '#8B93A1', fontWeight: '600', fontSize: 13 },
  labelFocused: { color: GOLD_INK, fontWeight: '700', fontSize: 13 },
});

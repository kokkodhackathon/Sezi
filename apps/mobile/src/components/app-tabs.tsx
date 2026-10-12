import { NativeTabs } from 'expo-router/unstable-native-tabs';

import { useSeziTheme } from '@/hooks/use-sezi-theme';

export default function AppTabs() {
  const t = useSeziTheme();

  return (
    <NativeTabs
      backgroundColor={t.surface}
      indicatorColor={t.border}
      labelStyle={{ default: { color: t.textMuted }, selected: { color: t.text } }}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Keşfet</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon src={require('@/assets/images/tabIcons/explore.png')} renderingMode="template" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="lab">
        <NativeTabs.Trigger.Label>Lab</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon src={require('@/assets/images/tabIcons/home.png')} renderingMode="template" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}

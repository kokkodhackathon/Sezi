import { NativeTabs } from 'expo-router/unstable-native-tabs';

import { font } from '@/design/type';
import { useSeziTheme } from '@/hooks/use-sezi-theme';
import { useT } from '@/lib/i18n';

export default function AppTabs() {
  const t = useSeziTheme();
  const { t: tr } = useT();

  return (
    <NativeTabs
      backgroundColor={t.surface}
      // Seçili sekme göstergesi: birincil rengin açık tonu; simge ve yazı birincil renkte kalır.
      indicatorColor={`${t.primary}2E`}
      iconColor={{ default: t.textMuted, selected: t.primary }}
      labelStyle={{
        default: { color: t.textMuted, fontFamily: font.bodySemi, fontSize: 13 },
        selected: { color: t.primary, fontFamily: font.bodyBold, fontSize: 13 },
      }}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>{tr('tabs.explore')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'map', selected: 'map.fill' }} md="explore" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="profile">
        <NativeTabs.Trigger.Label>{tr('tabs.profile')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'person.crop.circle', selected: 'person.crop.circle.fill' }} md="accessibility_new" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="lab">
        <NativeTabs.Trigger.Label>{tr('tabs.lab')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="waveform" md="graphic_eq" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}

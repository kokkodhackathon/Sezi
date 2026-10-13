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
      labelVisibilityMode="labeled"
      iconColor={{ default: t.textMuted, selected: t.primary }}
      labelStyle={{
        default: { color: t.textMuted, fontFamily: font.bodySemi, fontSize: 12 },
        selected: { color: t.primary, fontFamily: font.bodyBold, fontSize: 12 },
      }}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>{tr('tabs.explore')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'map', selected: 'map.fill' }} md="explore" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="tours">
        <NativeTabs.Trigger.Label>{tr('tabs.tours')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="point.topleft.down.to.point.bottomright.curvepath" md="route" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="ask">
        <NativeTabs.Trigger.Label>{tr('tabs.ask')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'bubble.left.and.text.bubble.right', selected: 'bubble.left.and.text.bubble.right.fill' }} md="forum" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="profile">
        <NativeTabs.Trigger.Label>{tr('tabs.profile')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'person.crop.circle', selected: 'person.crop.circle.fill' }} md="accessibility_new" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}

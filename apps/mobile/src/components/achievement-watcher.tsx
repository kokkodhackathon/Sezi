import { achievementLevels, loc, newlyEarned, type Achievement } from '@sezi/shared';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import Storage from 'expo-sqlite/kv-store';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Text, View } from 'react-native';
import { AchievementIcon, PopIn } from '@/components/social-visuals';
import { Button } from '@/components/ui';
import { SweetSheet } from '@/design/sweet/components';
import { space, type } from '@/design/type';
import { useSweetTheme } from '@/hooks/use-sweet-theme';
import { useAccount } from '@/lib/account';
import { useAchievements } from '@/lib/achievements';
import { useT } from '@/lib/i18n';

export function AchievementWatcher() {
  const { user } = useAccount();
  const { list, ready } = useAchievements();
  const { t: tr, lang } = useT();
  const t = useSweetTheme();
  const key = `sezi.ach.seen.${user?.id ?? 'anon'}.v1`;
  const [celebration, setCelebration] = useState<{ key: string; items: Achievement[] } | null>(null);
  const latest = useRef(list);
  useEffect(() => {
    latest.current = list;
  }, [list]);
  useEffect(() => {
    if (!ready || celebration?.key === key) return;
    let cancelled = false;
    // Görüldü kaydı asenkron okunur; hesap/veri değişirse eski sonuç atılır.
    const load = async () => {
      let seen: Record<string, number> | null = null;
      try {
        const raw = await Storage.getItem(key);
        if (raw) {
          const value: unknown = JSON.parse(raw);
          if (
            value &&
            typeof value === 'object' &&
            !Array.isArray(value) &&
            Object.values(value).every((level) => typeof level === 'number' && Number.isFinite(level))
          )
            seen = value as Record<string, number>;
        }
      } catch {
        // Bozuk görüldü kaydı mevcut düzeylerle yeniden kurulur.
      }
      if (cancelled) return;
      if (celebration && celebration.key !== key) setCelebration(null);
      if (!seen) {
        Storage.setItemSync(key, JSON.stringify(achievementLevels(list)));
        return;
      }
      const items = newlyEarned(seen, list);
      if (!items.length) return;
      setCelebration({ key, items });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      const first = items[0]!;
      AccessibilityInfo.announceForAccessibility(
        `${tr(`ach.${first.kind}.title`, { name: first.subject ? loc(first.subject.name, lang) : '' })}. ${tr('ach.level', { level: first.level, max: first.maxLevel })}`,
      );
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [key, list, ready, celebration, tr, lang]);
  const close = () => {
    if (celebration?.key === key) Storage.setItemSync(key, JSON.stringify(achievementLevels(latest.current)));
    setCelebration(null);
  };
  const first = celebration?.key === key ? celebration.items[0] : null;
  return (
    <SweetSheet
      visible={!!first}
      onClose={close}
      title={
        first
          ? tr(`ach.${first.kind}.title`, { name: first.subject ? loc(first.subject.name, lang) : '' })
          : tr('ach.title')
      }>
      {first ? (
        <View style={{ paddingHorizontal: space.xl, gap: space.lg, alignItems: 'center' }}>
          <PopIn>
            <AchievementIcon achievement={first} size={104} />
          </PopIn>
          {celebration!.items.length > 1 ? (
            <Text style={[type.meta, { color: t.textMuted }]}>
              {tr('ach.more', { n: celebration!.items.length - 1 })}
            </Text>
          ) : null}
          <View style={{ alignSelf: 'stretch' }}>
            <Button
              label={tr('ach.see')}
              onPress={() => {
                close();
                router.push('/achievements');
              }}
            />
          </View>
        </View>
      ) : null}
    </SweetSheet>
  );
}

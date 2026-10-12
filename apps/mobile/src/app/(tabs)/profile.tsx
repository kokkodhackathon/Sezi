import type { ThemeColors } from '@sezi/shared';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/screen-header';
import { CengelMark } from '@/design/motif';
import { radius, space, type, upper } from '@/design/type';
import { useSeziTheme } from '@/hooks/use-sezi-theme';
import { useT } from '@/lib/i18n';
import { useProfile } from '@/lib/profile';

export default function Profile() {
  const t = useSeziTheme();
  const s = useMemo(() => makeStyles(t), [t]);
  const { t: tr, lang } = useT();
  const { profile } = useProfile();
  if (!profile) return null;

  const senses = (['audio', 'haptic', 'visual'] as const)
    .filter((k) => profile.senses[k])
    .map((k) => tr(`onb.senses.${k}`))
    .join(', ');

  const rows: [string, string, string?][] = [
    [tr('profile.vision'), tr(`onb.vision.${profile.vision}`), tr(`onb.vision.${profile.vision}.d`)],
    [tr('profile.mobility'), tr(`onb.mobility.${profile.mobility}`), tr(`onb.mobility.${profile.mobility}.d`)],
    [tr('profile.senses'), senses],
    [tr('profile.lang'), profile.lang === 'tr' ? 'Türkçe' : 'English'],
  ];

  return (
    <SafeAreaView style={s.screen} edges={['top']}>
      <ScrollView contentContainerStyle={s.body}>
        <ScreenHeader eyebrow={tr('profile.eyebrow')} title={tr('profile.title')} subtitle={tr('profile.hint')} />
        <View style={s.card}>
          {rows.map(([label, value, desc], i) => (
            <View
              key={label}
              style={[s.row, i > 0 && s.rowBorder]}
              accessible
              accessibilityLabel={[label, value, desc].filter(Boolean).join(': ')}>
              <View style={s.labelRow}>
                <CengelMark color={t.accent} size={12} />
                <Text style={[type.eyebrow, { color: t.textMuted }]}>{upper(label, lang)}</Text>
              </View>
              <Text style={[type.itemTitle, { color: t.text }]}>{value}</Text>
              {desc ? <Text style={[type.meta, { color: t.textMuted }]}>{desc}</Text> : null}
            </View>
          ))}
        </View>
        <Pressable
          onPress={() => router.push('/onboarding')}
          accessibilityRole="button"
          style={({ pressed }) => [s.btn, pressed && { opacity: 0.88 }]}>
          <Text style={[type.button, { color: t.onPrimary }]}>{tr('profile.edit')}</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (t: ThemeColors) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.background },
    body: { paddingHorizontal: space.lg, paddingBottom: space.xxl, gap: space.xl },
    card: { backgroundColor: t.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: t.border, overflow: 'hidden' },
    row: { padding: space.lg, gap: space.xs },
    rowBorder: { borderTopWidth: 1, borderTopColor: t.border },
    labelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    btn: { minHeight: 56, borderRadius: radius.pill, backgroundColor: t.primary, alignItems: 'center', justifyContent: 'center' },
  });

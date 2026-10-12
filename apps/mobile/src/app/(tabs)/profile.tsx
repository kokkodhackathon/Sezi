import type { ThemeColors } from '@sezi/shared';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useSeziTheme } from '@/hooks/use-sezi-theme';
import { useT } from '@/lib/i18n';
import { useProfile } from '@/lib/profile';

export default function Profile() {
  const t = useSeziTheme();
  const s = useMemo(() => makeStyles(t), [t]);
  const { t: tr } = useT();
  const { profile } = useProfile();
  if (!profile) return null;

  const senses = (['audio', 'haptic', 'visual'] as const)
    .filter((k) => profile.senses[k])
    .map((k) => tr(`onb.senses.${k}`))
    .join(', ');

  const rows: [string, string][] = [
    [tr('profile.lang'), profile.lang === 'tr' ? 'Türkçe' : 'English'],
    [tr('profile.vision'), tr(`onb.vision.${profile.vision}`)],
    [tr('profile.mobility'), tr(`onb.mobility.${profile.mobility}`)],
    [tr('profile.senses'), senses],
  ];

  return (
    <SafeAreaView style={s.screen} edges={['top']}>
      <ScrollView contentContainerStyle={s.body}>
        <Text style={s.title} accessibilityRole="header">
          {tr('profile.title')}
        </Text>
        <View style={s.card}>
          {rows.map(([label, value], i) => (
            <View key={label} style={[s.row, i > 0 && s.rowBorder]} accessible accessibilityLabel={`${label}: ${value}`}>
              <Text style={s.label}>{label}</Text>
              <Text style={s.value}>{value}</Text>
            </View>
          ))}
        </View>
        <Pressable
          onPress={() => router.push('/onboarding')}
          accessibilityRole="button"
          style={({ pressed }) => [s.btn, pressed && { opacity: 0.85 }]}>
          <Text style={s.btnText}>{tr('profile.edit')}</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (t: ThemeColors) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.background },
    body: { padding: 16, gap: 16 },
    title: { fontSize: 30, fontWeight: '700', color: t.text, marginTop: 8 },
    card: { backgroundColor: t.surface, borderRadius: 16, borderWidth: 1, borderColor: t.border },
    row: { padding: 16, gap: 4 },
    rowBorder: { borderTopWidth: 1, borderTopColor: t.border },
    label: { fontSize: 14, fontWeight: '600', color: t.textMuted },
    value: { fontSize: 17, color: t.text },
    btn: { minHeight: 52, borderRadius: 14, backgroundColor: t.primary, alignItems: 'center', justifyContent: 'center' },
    btnText: { fontSize: 17, fontWeight: '700', color: t.onPrimary },
  });

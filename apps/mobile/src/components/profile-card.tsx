import type { SweetTheme, UserProfile } from '@sezi/shared';
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ChevronIcon, EyeIcon, HearingIcon, LanguageIcon, MobilityIcon, SensesIcon } from '@/design/icons';
import { outline, SoftPressable } from '@/design/sweet/components';
import { radius, space, type } from '@/design/type';
import { useSweetTheme } from '@/hooks/use-sweet-theme';
import { translate } from '@/lib/i18n';

export type ProfileField = 'vision' | 'hearing' | 'mobility' | 'senses' | 'lang';

/** Aynı kart kayıtlı tercihleri ve onboarding önizlemesini gösterir. */
export function ProfileCard({ profile, onEdit, theme }: { profile: UserProfile; onEdit?: (field: ProfileField) => void; theme?: SweetTheme }) {
  const currentTheme = useSweetTheme();
  const t = theme ?? currentTheme;
  const tr = (key: Parameters<typeof translate>[1]) => translate(profile.lang, key);
  const senses = (['audio', 'haptic', 'visual'] as const).filter((key) => profile.senses[key]).map((key) => tr(`onb.senses.${key}`)).join(', ');
  const fields: { key: ProfileField; label: string; value: string; icon: (color: string) => ReactNode }[] = [
    { key: 'vision', label: tr('profile.vision'), value: tr(`onb.vision.${profile.vision}`), icon: (color) => <EyeIcon color={color} /> },
    { key: 'hearing', label: tr('profile.hearing'), value: tr(`onb.hearing.${profile.hearing}`), icon: (color) => <HearingIcon color={color} /> },
    { key: 'mobility', label: tr('profile.mobility'), value: tr(`onb.mobility.${profile.mobility}`), icon: (color) => <MobilityIcon color={color} /> },
    { key: 'senses', label: tr('profile.senses'), value: senses, icon: (color) => <SensesIcon color={color} /> },
    { key: 'lang', label: tr('profile.lang'), value: profile.lang === 'tr' ? 'Türkçe' : 'English', icon: (color) => <LanguageIcon color={color} /> },
  ];
  return <View style={[s.card, { backgroundColor: t.surface }, outline(t)]}>
    <Text style={[type.title, { color: t.text }]} accessibilityRole="header">{tr('profile.eyebrow')}</Text>
    <View style={s.pills}>
      {fields.map((field) => {
        const content = <>{field.icon(t.primaryText)}<View style={s.value}><Text style={[type.meta, { color: t.textMuted }]}>{field.label}</Text><Text style={[type.cardTitle, { color: t.text }]}>{field.value}</Text></View>{onEdit ? <ChevronIcon color={t.textMuted} size={16} /> : null}</>;
        const style = [s.pill, { backgroundColor: t.soft }, outline(t)];
        return onEdit ? <SoftPressable key={field.key} style={style} onPress={() => onEdit(field.key)} accessibilityRole="button" accessibilityLabel={`${field.label}: ${field.value}`} accessibilityHint={tr('profile.edit')}>{content}</SoftPressable> : <View key={field.key} style={style} accessible accessibilityLabel={`${field.label}: ${field.value}`}>{content}</View>;
      })}
    </View>
  </View>;
}

const s = StyleSheet.create({
  card: { padding: space.lg, borderRadius: radius.lg, borderCurve: 'continuous', gap: space.lg },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  pill: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 48, maxWidth: '100%', padding: space.md, borderRadius: radius.md, borderCurve: 'continuous', flexGrow: 1 },
  value: { flexGrow: 1, flexShrink: 1, gap: space.xs },
});

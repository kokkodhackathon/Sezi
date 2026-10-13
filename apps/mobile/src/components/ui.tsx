/**
 * Sezi arayüz bileşenleri. Tüm ekranlar bunlardan kurulur: tek dokunma alanı ölçüsü (≥ 48 dp),
 * rolüne göre köşe dili (12 dp düğme, 16 dp kart), tek tipografi ölçeği.
 */
import type { ThemeColors } from '@sezi/shared';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Switch, Text, TextInput, useWindowDimensions, View, type TextInputProps, type ViewStyle } from 'react-native';

import { ChevronIcon } from '@/design/icons';
import { radius, space, type } from '@/design/type';
import { useSeziTheme } from '@/hooks/use-sezi-theme';

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';

export function Button({
  label,
  onPress,
  variant = 'primary',
  icon,
  disabled,
  hint,
  style,
  compact,
}: {
  label: string;
  onPress: () => void;
  variant?: Variant;
  icon?: (color: string) => ReactNode;
  disabled?: boolean;
  hint?: string;
  style?: ViewStyle;
  compact?: boolean;
}) {
  const t = useSeziTheme();
  const v = variantColors(t, variant);
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => [
        styles.btn,
        compact && styles.btnCompact,
        { backgroundColor: v.bg, borderColor: v.border },
        disabled && { opacity: 0.4 },
        pressed && { opacity: 0.85 },
        style,
      ]}>
      {icon ? icon(v.fg) : null}
      <Text style={[type.button, { color: v.fg, flexShrink: 1, textAlign: 'center' }]}>{label}</Text>
    </Pressable>
  );
}

function variantColors(t: ThemeColors, v: Variant) {
  switch (v) {
    case 'primary':
      return { bg: t.primary, fg: t.onPrimary, border: t.primary };
    case 'secondary':
      return { bg: t.text, fg: t.background, border: t.text };
    case 'outline':
      return { bg: t.surface, fg: t.primary, border: t.primary };
    case 'danger':
      return { bg: t.surface, fg: t.danger, border: t.danger };
    default:
      return { bg: 'transparent', fg: t.primary, border: 'transparent' };
  }
}

export function Card({ children, style, padded = true }: { children: ReactNode; style?: ViewStyle; padded?: boolean }) {
  const t = useSeziTheme();
  return <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.border }, padded && { padding: space.lg }, style]}>{children}</View>;
}

export function SectionTitle({ title, action }: { title: string; action?: ReactNode }) {
  const t = useSeziTheme();
  return (
    <View style={styles.sectionTitle}>
      <Text style={[type.heading, { color: t.text, flex: 1 }]} accessibilityRole="header">
        {title}
      </Text>
      {action}
    </View>
  );
}

export function Eyebrow({ text, color }: { text: string; color?: string }) {
  const t = useSeziTheme();
  return <Text style={[type.meta, { color: color ?? t.textMuted }]}>{text}</Text>;
}

/** Liste satırı: solda simge, ortada başlık + açıklama, sağda ok ya da özel öğe. */
export function ListRow({
  title,
  subtitle,
  leading,
  trailing,
  onPress,
  hint,
  first,
  danger,
}: {
  title: string;
  subtitle?: string;
  leading?: ReactNode;
  trailing?: ReactNode;
  onPress?: () => void;
  hint?: string;
  first?: boolean;
  danger?: boolean;
}) {
  const t = useSeziTheme();
  const body = (
    <>
      {leading}
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[type.itemTitle, { color: danger ? t.danger : t.text, fontSize: 17 }]}>{title}</Text>
        {subtitle ? <Text style={[type.meta, { color: t.textMuted }]}>{subtitle}</Text> : null}
      </View>
      {trailing ?? (onPress ? <ChevronIcon color={t.textMuted} /> : null)}
    </>
  );
  const rowStyle = [styles.row, !first && { borderTopWidth: 1, borderTopColor: t.border }];
  if (!onPress) {
    return (
      <View style={rowStyle} accessible accessibilityLabel={[title, subtitle].filter(Boolean).join(', ')}>
        {body}
      </View>
    );
  }
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={[title, subtitle].filter(Boolean).join(', ')}
      accessibilityHint={hint}
      style={({ pressed }) => [...rowStyle, pressed && { backgroundColor: t.background }]}>
      {body}
    </Pressable>
  );
}

export function ToggleRow({ title, subtitle, value, onChange, first }: { title: string; subtitle?: string; value: boolean; onChange: (v: boolean) => void; first?: boolean }) {
  const t = useSeziTheme();
  return (
    <Pressable
      onPress={() => onChange(!value)}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      accessibilityLabel={[title, subtitle].filter(Boolean).join(', ')}
      style={[styles.row, !first && { borderTopWidth: 1, borderTopColor: t.border }]}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[type.itemTitle, { color: t.text, fontSize: 17 }]}>{title}</Text>
        {subtitle ? <Text style={[type.meta, { color: t.textMuted }]}>{subtitle}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: t.border, true: t.primary }}
        thumbColor={t.surface}
        importantForAccessibility="no"
        accessibilityElementsHidden
      />
    </Pressable>
  );
}

/** Seçeneklerden birini seçtiren yatay grup (radyo düğmesi semantiği). */
export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
}) {
  const t = useSeziTheme();
  const { fontScale } = useWindowDimensions();
  return (
    <View style={[styles.segmented, { backgroundColor: t.background, borderColor: t.textMuted, flexDirection: fontScale > 1.5 ? 'column' : 'row' }]} accessibilityRole="radiogroup" accessibilityLabel={label}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={String(o.value)}
            onPress={() => onChange(o.value)}
            accessibilityRole="radio"
            accessibilityLabel={o.label}
            accessibilityState={{ checked: on }}
            style={[styles.segment, on && { backgroundColor: t.surface, borderColor: t.primary, borderWidth: 2 }]}>
            <Text style={[type.button, { fontSize: 15, color: on ? t.primary : t.textMuted, textAlign: 'center', flexShrink: 1 }]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Chip({ label, selected, onPress, icon }: { label: string; selected: boolean; onPress: () => void; icon?: (color: string) => ReactNode }) {
  const t = useSeziTheme();
  const fg = selected ? t.onPrimary : t.text;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      style={({ pressed }) => [
        styles.chip,
        { borderColor: selected ? t.primary : t.border, backgroundColor: selected ? t.primary : t.surface },
        pressed && { opacity: 0.85 },
      ]}>
      {icon ? icon(fg) : null}
      <Text style={[type.button, { color: fg, fontSize: 15, flexShrink: 1 }]}>{label}</Text>
    </Pressable>
  );
}

/** Küçük durum etiketi (ör. "Basamaksız", "Ziyaret edildi", "Beklemede"). */
export function Badge({ label, tone = 'neutral' }: { label: string; tone?: 'neutral' | 'primary' | 'accent' | 'danger' }) {
  const t = useSeziTheme();
  const c = { neutral: t.textMuted, primary: t.primary, accent: t.accent, danger: t.danger }[tone];
  return (
    <View style={[styles.badge, { borderColor: t.border }]}>
      <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: c }} />
      <Text style={[type.meta, { color: c }]}>{label}</Text>
    </View>
  );
}

export function EmptyState({ title, body, icon, action }: { title: string; body?: string; icon?: ReactNode; action?: ReactNode }) {
  const t = useSeziTheme();
  return (
    <View style={[styles.empty, { borderColor: t.border, backgroundColor: t.surface }]}>
      {icon}
      <Text style={[type.heading, { color: t.text, textAlign: 'center' }]}>{title}</Text>
      {body ? <Text style={[type.body, { color: t.textMuted, textAlign: 'center' }]}>{body}</Text> : null}
      {action}
    </View>
  );
}

export function Field({ label, error, help, ...input }: TextInputProps & { label: string; error?: string; help?: string }) {
  const t = useSeziTheme();
  return (
    <View style={{ gap: space.xs }}>
      <Text style={[type.itemTitle, { color: t.text, fontSize: 16 }]} nativeID={`lbl-${label}`}>
        {label}
      </Text>
      <TextInput
        placeholderTextColor={t.textMuted}
        accessibilityLabel={label}
        accessibilityHint={help}
        {...input}
        style={[
          type.body,
          styles.input,
          { color: t.text, backgroundColor: t.surface, borderColor: error ? t.danger : t.textMuted },
          input.multiline && { minHeight: 120, textAlignVertical: 'top' },
        ]}
      />
      {error ? (
        <Text style={[type.meta, { color: t.danger }]} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : help ? (
        <Text style={[type.meta, { color: t.textMuted }]}>{help}</Text>
      ) : null}
    </View>
  );
}

/** Bilgi notu: kesik çizgili kutu (taslak, simülasyon, veri kaynağı açıklamaları). */
export function Note({ text, icon }: { text: string; icon?: ReactNode }) {
  const t = useSeziTheme();
  return (
    <View style={[styles.note, { borderColor: t.border, backgroundColor: t.surface }]}>
      {icon}
      <Text style={[type.meta, { color: t.textMuted, flex: 1 }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  btn: {
    flexDirection: 'row',
    gap: space.sm,
    minHeight: 56,
    paddingHorizontal: space.xl,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingVertical: space.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnCompact: { minHeight: 48, paddingHorizontal: space.lg },
  card: { borderRadius: radius.lg, borderWidth: 1, overflow: 'hidden' },
  sectionTitle: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingTop: space.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 64, paddingHorizontal: space.lg, paddingVertical: space.md },
  segmented: { flexDirection: 'row', padding: 4, borderRadius: radius.md, borderWidth: 1, gap: 4 },
  segment: { flex: 1, minWidth: 48, minHeight: 48, paddingVertical: space.sm, paddingHorizontal: space.xs, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'transparent' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: 48, minHeight: 48, paddingVertical: space.sm, paddingHorizontal: space.lg, borderRadius: radius.pill, borderWidth: 1 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingHorizontal: space.sm, paddingVertical: 4, borderRadius: radius.sm, borderWidth: 1 },
  empty: { alignItems: 'center', gap: space.md, paddingVertical: space.xxl, paddingHorizontal: space.lg },
  input: { minHeight: 56, paddingHorizontal: space.lg, paddingVertical: space.md, borderRadius: radius.md, borderWidth: 1 },
  note: { flexDirection: 'row', gap: space.md, padding: space.lg, borderRadius: radius.md, borderWidth: 1 },
});

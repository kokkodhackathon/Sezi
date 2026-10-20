/**
 * Sezi arayüz bileşenleri (Çini 2). Tüm ekranlar bunlardan ve `design/sweet/components` parçalarından kurulur:
 * tek dokunma alanı ölçüsü (≥ 48 dp), tek köşe ölçeği (`radius`), tek tipografi ölçeği (`type`).
 * Yüzeyler düz: kart ve alanlar dolgu tonuyla ayrılır; yüksek kontrastta 2 dp çerçeve (`outline`).
 */
import type { ReactNode } from 'react';
import { StyleSheet, Switch, Text, TextInput, useWindowDimensions, View, type StyleProp, type TextInputProps, type ViewStyle } from 'react-native';

import { ChevronIcon } from '@/design/icons';
import { outline, SoftPressable } from '@/design/sweet/components';
import { radius, space, type } from '@/design/type';
import { useSweetTheme } from '@/hooks/use-sweet-theme';

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';

/**
 * Düğme: 54 dp (kompakt 48), 16 köşe. `primary` firuze dolgu, `secondary` gri dolgu,
 * `outline` yüzey + ince çerçeve, `ghost` yalnız yazı, `danger` yüzey üstünde tehlike rengi.
 */
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
  style?: StyleProp<ViewStyle>;
  compact?: boolean;
}) {
  const t = useSweetTheme();
  const v = {
    primary: { bg: t.primary.fill, fg: t.primary.ink, border: t.primary.fill },
    secondary: { bg: t.soft, fg: t.text, border: t.soft },
    outline: { bg: t.surface, fg: t.text, border: t.border },
    ghost: { bg: 'transparent', fg: t.primaryText, border: 'transparent' },
    danger: { bg: t.surface, fg: t.danger, border: t.danger },
  }[variant];
  return (
    <SoftPressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={{ disabled: !!disabled }}
      style={[
        styles.btn,
        compact && styles.btnCompact,
        { backgroundColor: v.bg, borderColor: t.outlined && variant !== 'ghost' ? t.border : v.border },
        t.outlined && variant !== 'ghost' && { borderWidth: 2 },
        disabled && { opacity: 0.4 },
        style,
      ]}>
      {icon ? icon(v.fg) : null}
      <Text style={[type.button, { color: v.fg, flexShrink: 1, textAlign: 'center' }]}>{label}</Text>
    </SoftPressable>
  );
}

/** Kart: beyaz yüzey, 22 köşe, gölgesiz (zeminden tonla ayrılır). */
export function Card({ children, style, padded = true }: { children: ReactNode; style?: StyleProp<ViewStyle>; padded?: boolean }) {
  const t = useSweetTheme();
  return <View style={[styles.card, { backgroundColor: t.surface }, outline(t), padded && { padding: space.lg }, style]}>{children}</View>;
}

export function SectionTitle({ title, action }: { title: string; action?: ReactNode }) {
  const t = useSweetTheme();
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
  const t = useSweetTheme();
  return <Text style={[type.meta, { color: color ?? t.textMuted }]}>{text}</Text>;
}

/** Liste satırı: solda simge, ortada başlık + açıklama, sağda ok ya da özel öğe. Kart içinde ince çizgiyle ayrılır. */
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
  const t = useSweetTheme();
  const body = (
    <>
      {leading}
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[type.itemTitle, { color: danger ? t.danger : t.text }]}>{title}</Text>
        {subtitle ? <Text style={[type.meta, { color: t.textMuted }]}>{subtitle}</Text> : null}
      </View>
      {trailing ?? (onPress ? <ChevronIcon color={t.textMuted} size={18} /> : null)}
    </>
  );
  const rowStyle = [styles.row, !first && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.border }, !first && t.outlined && { borderTopWidth: 1 }];
  if (!onPress) {
    return (
      <View style={rowStyle} accessible accessibilityLabel={[title, subtitle].filter(Boolean).join(', ')}>
        {body}
      </View>
    );
  }
  return (
    <SoftPressable onPress={onPress} accessibilityRole="button" accessibilityLabel={[title, subtitle].filter(Boolean).join(', ')} accessibilityHint={hint} style={rowStyle}>
      {body}
    </SoftPressable>
  );
}

export function ToggleRow({ title, subtitle, value, onChange, first }: { title: string; subtitle?: string; value: boolean; onChange: (v: boolean) => void; first?: boolean }) {
  const t = useSweetTheme();
  return (
    <SoftPressable
      onPress={() => onChange(!value)}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      accessibilityLabel={[title, subtitle].filter(Boolean).join(', ')}
      style={[styles.row, !first && { borderTopWidth: t.outlined ? 1 : StyleSheet.hairlineWidth, borderTopColor: t.border }]}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[type.itemTitle, { color: t.text }]}>{title}</Text>
        {subtitle ? <Text style={[type.meta, { color: t.textMuted }]}>{subtitle}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: t.soft, true: t.primaryText }}
        thumbColor={t.surface}
        ios_backgroundColor={t.soft}
        importantForAccessibility="no"
        accessibilityElementsHidden
      />
    </SoftPressable>
  );
}

/** Seçeneklerden birini seçtiren yatay grup (radyo düğmesi semantiği): gri ray, seçili parça beyaz. */
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
  const t = useSweetTheme();
  const { fontScale } = useWindowDimensions();
  return (
    <View
      style={[styles.segmented, { backgroundColor: t.soft, flexDirection: fontScale > 1.5 ? 'column' : 'row' }, outline(t)]}
      accessibilityRole="radiogroup"
      accessibilityLabel={label}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <SoftPressable
            key={String(o.value)}
            onPress={() => onChange(o.value)}
            accessibilityRole="radio"
            accessibilityLabel={o.label}
            accessibilityState={{ checked: on }}
            style={[styles.segment, on && { backgroundColor: t.outlined ? t.text : t.surface }]}>
            <Text style={[type.button, { fontSize: 15, color: on ? (t.outlined ? t.background : t.text) : t.textMuted, textAlign: 'center', flexShrink: 1 }]}>{o.label}</Text>
          </SoftPressable>
        );
      })}
    </View>
  );
}

/** Seçim çipi: gri dolgu; seçiliyken firuze dolgu ve kalın yazı. */
export function Chip({ label, selected, onPress, icon }: { label: string; selected: boolean; onPress: () => void; icon?: (color: string) => ReactNode }) {
  const t = useSweetTheme();
  const fg = selected ? t.primary.ink : t.text;
  return (
    <SoftPressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      style={[styles.chip, { backgroundColor: selected ? t.primary.fill : t.soft }, outline(t), selected && t.outlined && { borderWidth: 3 }]}>
      {icon ? icon(fg) : null}
      <Text style={[type.bubble, { color: fg, fontSize: 15, flexShrink: 1 }, selected && { fontFamily: type.button.fontFamily }]}>{label}</Text>
    </SoftPressable>
  );
}

/** Küçük durum etiketi (ör. "Basamaksız", "Ziyaret edildi", "Beklemede"). */
export function Badge({ label, tone = 'neutral' }: { label: string; tone?: 'neutral' | 'primary' | 'accent' | 'danger' }) {
  const t = useSweetTheme();
  const c = {
    neutral: { bg: t.soft, fg: t.text },
    primary: { bg: t.primary.fill, fg: t.primary.ink },
    accent: { bg: t.accent.fill, fg: t.accent.ink },
    danger: { bg: t.soft, fg: t.danger },
  }[tone];
  return (
    <View style={[styles.badge, { backgroundColor: c.bg }, outline(t)]}>
      <Text style={[type.bubble, { color: c.fg }, tone !== 'neutral' && { fontFamily: type.button.fontFamily }]}>{label}</Text>
    </View>
  );
}

export function EmptyState({ title, body, icon, action }: { title: string; body?: string; icon?: ReactNode; action?: ReactNode }) {
  const t = useSweetTheme();
  return (
    <View style={styles.empty}>
      {icon}
      <Text style={[type.heading, { color: t.text, textAlign: 'center' }]}>{title}</Text>
      {body ? <Text style={[type.body, { color: t.textMuted, textAlign: 'center' }]}>{body}</Text> : null}
      {action}
    </View>
  );
}

/** Yazı alanı: görünür etiket, gri dolgu, 16 köşe; hata durumunda tehlike rengi çerçeve ve yazı. */
export function Field({ label, error, help, ...input }: TextInputProps & { label: string; error?: string; help?: string }) {
  const t = useSweetTheme();
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
          { color: t.text, backgroundColor: t.soft, borderColor: error ? t.danger : t.outlined ? t.border : t.soft },
          t.outlined && { borderWidth: 2 },
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

/** Bilgi notu (taslak, simülasyon, veri kaynağı açıklamaları): gri dolgulu kutu. */
export function Note({ text, icon }: { text: string; icon?: ReactNode }) {
  const t = useSweetTheme();
  return (
    <View style={[styles.note, { backgroundColor: t.soft }, outline(t)]}>
      {icon}
      <Text style={[type.meta, { color: t.textMuted, flex: 1 }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  btn: {
    flexDirection: 'row',
    gap: space.sm,
    minHeight: 54,
    paddingHorizontal: space.xl,
    borderRadius: radius.md,
    borderCurve: 'continuous',
    borderWidth: 1,
    paddingVertical: space.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnCompact: { minHeight: 48, paddingHorizontal: space.lg },
  card: { borderRadius: radius.lg, borderCurve: 'continuous', overflow: 'hidden' },
  sectionTitle: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingTop: space.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 64, paddingHorizontal: space.lg, paddingVertical: space.md },
  segmented: { flexDirection: 'row', padding: 4, borderRadius: radius.md, borderCurve: 'continuous', gap: 4 },
  segment: {
    flex: 1,
    minWidth: 48,
    minHeight: 48,
    paddingVertical: space.sm,
    paddingHorizontal: space.xs,
    borderRadius: 12,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minWidth: 48,
    minHeight: 48,
    paddingVertical: space.sm,
    paddingHorizontal: space.lg,
    borderRadius: radius.sm,
    borderCurve: 'continuous',
  },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8 },
  empty: { alignItems: 'center', gap: space.md, paddingVertical: space.xxl, paddingHorizontal: space.lg },
  input: { minHeight: 54, paddingHorizontal: space.lg, paddingVertical: space.md, borderRadius: radius.md, borderCurve: 'continuous', borderWidth: 1 },
  note: { flexDirection: 'row', gap: space.md, padding: space.lg, borderRadius: radius.md, borderCurve: 'continuous' },
});

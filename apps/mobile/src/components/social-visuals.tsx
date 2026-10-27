import { loc, THRESHOLDS, toneForType, type Achievement, type AchievementKind, type UserPhoto, type Visibility } from '@sezi/shared';
import * as Haptics from 'expo-haptics';
import { useEffect, type ComponentType, type ReactNode } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { ProgressBar } from '@/components/ui';
import {
  ArchiveIcon,
  CameraIcon,
  CheckIcon,
  ClockIcon,
  CloseIcon,
  FlagIcon,
  FootprintsIcon,
  GlobeIcon,
  LandmarkIcon,
  LockIcon,
  MapAreaIcon,
  PersonIcon,
  RouteIcon,
  ShapesIcon,
  StampIcon,
  UsersIcon,
} from '@/design/icons';
import { outline, SoftPressable } from '@/design/sweet/components';
import { duration, ease } from '@/design/sweet/motion';
import { radius, space, type } from '@/design/type';
import { WorkGlyphInline } from '@/design/work-glyph';
import { useReducedMotion } from '@/hooks/use-reduced-motion';
import { useSweetTheme } from '@/hooks/use-sweet-theme';
import { useT, type Lang, type Translate } from '@/lib/i18n';

type Icon = ComponentType<{ color: string; size?: number }>;

/** Damga eğimi: slug'dan belirlenir (−3°…+3°), her açılışta aynı. Web'de aynı kural. */
export function stampTilt(slug: string): number {
  let sum = 0;
  for (let i = 0; i < slug.length; i++) sum += slug.charCodeAt(i);
  return (sum % 7) - 3;
}

/**
 * Izgara sütunu: dar ekranda ve büyük yazıda azalır (yazı ölçeği ≥ 1,5 → 2 sütun).
 * `min` kutucuğun en dar genişliği (dp).
 */
export function useGridColumns(min = 96, max = 3) {
  const { width, fontScale } = useWindowDimensions();
  const fit = Math.floor((width - space.xl * 2 + space.md) / (min + space.md));
  return Math.max(1, Math.min(fontScale >= 1.5 ? 2 : max, fit));
}

/**
 * Ziyaret damgası: eser türü tonunda kare, ortada tür glifi, içte kesikli mühür çizgisi, hafif eğik.
 * `fresh`: yeni basıldıysa bir kez "basılır" (büyükten iner, eğime döner). Reduce motion: yalnız opacity.
 * Dekoratiftir; erişilebilir ad çağıranın etiketinde.
 */
export function Stamp({ slug, typeSlug, size = 88, fresh }: { slug: string; typeSlug: string; size?: number; fresh?: boolean }) {
  const t = useSweetTheme();
  const reduced = useReducedMotion();
  const tone = t.tones[toneForType(typeSlug)];
  const tilt = stampTilt(slug);
  const scale = useSharedValue(fresh && !reduced ? 1.25 : 1);
  const angle = useSharedValue(fresh && !reduced ? 0 : tilt);
  const opacity = useSharedValue(fresh ? 0 : 1);
  useEffect(() => {
    if (!fresh) return;
    const timing = { duration: duration.sheetIn, easing: ease.out };
    opacity.set(withTiming(1, { duration: reduced ? duration.fade : duration.enter }));
    if (!reduced) {
      scale.set(withTiming(1, timing));
      angle.set(withTiming(tilt, timing));
    }
  }, [fresh, reduced, tilt, scale, angle, opacity]);
  const animated = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }, { rotate: `${angle.value}deg` }],
  }));
  const fill = t.outlined ? t.surface : tone.fill;
  const ink = t.outlined ? t.text : tone.ink;
  return (
    <Animated.View
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      style={[s.stamp, { width: size, height: size, backgroundColor: fill }, outline(t), animated]}>
      <View style={[s.stampRing, { borderColor: ink }]}>
        <WorkGlyphInline slug={typeSlug} color={ink} size={size * 0.46} />
      </View>
    </Animated.View>
  );
}

/** Henüz basılmamış damga yeri: kesikli çerçeve. */
export function EmptyStamp({ size = 72 }: { size?: number }) {
  const t = useSweetTheme();
  return <View style={[s.stamp, s.dashed, { width: size, height: size, borderColor: t.border }]} />;
}

/** Boş pasaport çizimi: üç boş damga yeri, ortadaki öne çıkar. */
export function EmptyPassportArt() {
  return (
    <View style={s.art} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      <View style={{ transform: [{ rotate: '-4deg' }] }}>
        <EmptyStamp size={60} />
      </View>
      <EmptyStamp size={76} />
      <View style={{ transform: [{ rotate: '3deg' }] }}>
        <EmptyStamp size={60} />
      </View>
    </View>
  );
}

/** Boş fotoğraf çizimi: kesikli çerçeve içinde kamera. */
export function EmptyPhotoArt() {
  const t = useSweetTheme();
  return (
    <View style={s.art} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      <View style={[s.stamp, s.dashed, { width: 88, height: 88, borderColor: t.border }]}>
        <CameraIcon color={t.textMuted} size={34} />
      </View>
    </View>
  );
}

/** Arkadaş çizimi: üst üste binen iki yuvarlak, içlerinde kişi. */
export function FriendsArt({ size = 64 }: { size?: number }) {
  const t = useSweetTheme();
  const a = t.outlined ? { fill: t.surface, ink: t.text } : t.primary;
  const b = t.outlined ? { fill: t.surface, ink: t.text } : t.tones.saffron;
  const circle = (tone: { fill: string; ink: string }, style: object) => (
    <View style={[s.circle, { width: size, height: size, borderRadius: size / 2, backgroundColor: tone.fill, borderColor: t.background }, style]}>
      <PersonIcon color={tone.ink} size={size * 0.46} filled />
    </View>
  );
  return (
    <View style={s.art} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      {circle(a, { zIndex: 1 })}
      {circle(b, { marginLeft: -size * 0.28 })}
    </View>
  );
}

/** Gizli profil çizimi: yumuşak daire içinde büyük kilit. */
export function LockedArt() {
  const t = useSweetTheme();
  return (
    <View style={s.art} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      <View style={[s.circle, { width: 88, height: 88, borderRadius: 44, backgroundColor: t.soft, borderColor: t.soft }, outline(t)]}>
        <LockIcon color={t.textMuted} size={36} />
      </View>
    </View>
  );
}

/** Boş durum: çizim + tek kısa cümle + isteğe bağlı tek eylem. */
export function EmptyInvite({ art, text, action }: { art: ReactNode; text: string; action?: ReactNode }) {
  const t = useSweetTheme();
  return (
    <View style={s.invite}>
      {art}
      <Text style={[type.itemTitle, { color: t.text, textAlign: 'center' }]}>{text}</Text>
      {action}
    </View>
  );
}

/** Sayı şeridi: simge + büyük sayı + tek sözcük. Her kutu tek ekran okuyucu öğesi ("8 damga"). */
export function StatStrip({ items }: { items: { icon: Icon; value: string; label: string }[] }) {
  const t = useSweetTheme();
  return (
    <View style={s.strip}>
      {items.map(({ icon: I, value, label }) => (
        <View
          key={label}
          accessible
          accessibilityLabel={`${value} ${label}`}
          style={[s.stat, { backgroundColor: t.soft }, outline(t)]}>
          <I color={t.primaryText} size={22} />
          <Text style={[s.statValue, { color: t.text }]} numberOfLines={1} adjustsFontSizeToFit>
            {value}
          </Text>
          <Text style={[type.meta, { color: t.textMuted }]} numberOfLines={1}>
            {label}
          </Text>
        </View>
      ))}
    </View>
  );
}

/** Başarım türü → simge; web'de aynı kavramın lucide karşılığı. */
export const ACHIEVEMENT_ICONS: Record<AchievementKind, Icon> = {
  first_stamp: StampIcon,
  stamps: StampIcon,
  types: ShapesIcon,
  cities: MapAreaIcon,
  walker: FootprintsIcon,
  complex: LandmarkIcon,
  tour: RouteIcon,
  reporter: FlagIcon,
  photographer: ArchiveIcon,
  sharer: GlobeIcon,
  companion: UsersIcon,
};

export function achievementTitle(a: Achievement, tr: Translate, lang: Lang) {
  return tr(`ach.${a.kind}.title`, { name: a.subject ? loc(a.subject.name, lang) : '' });
}

export function achievementTarget(a: Achievement) {
  const thresholds = a.kind === 'complex' || a.kind === 'tour' ? null : THRESHOLDS[a.kind];
  return a.nextTarget ?? thresholds?.[thresholds.length - 1] ?? a.current;
}

/** Ekran okuyucu cümlesi: "İlk damga. Kazanıldı, 25 Ekim 2026" ya da "Vakıf kâşifi. Kilitli, 1 / 5". */
export function achievementLabel(a: Achievement, tr: Translate, lang: Lang) {
  const title = achievementTitle(a, tr, lang);
  if (a.level > 0) {
    const date = a.earnedAt ? new Date(a.earnedAt).toLocaleDateString(lang, { dateStyle: 'long' }) : null;
    return `${title}. ${tr('ach.earnedStatus')}${date ? `, ${date}` : ''}`;
  }
  return `${title}. ${tr('ach.locked')}, ${a.current} / ${achievementTarget(a)}`;
}

/** Başarım simge karosu: kazanılanda firuze dolgu + köşede tik; kilitlide soluk dolgu + köşede kilit. */
export function AchievementIcon({ achievement: a, size = 72 }: { achievement: Achievement; size?: number }) {
  const t = useSweetTheme();
  const earned = a.level > 0;
  const I = ACHIEVEMENT_ICONS[a.kind];
  const fill = t.outlined ? t.surface : earned ? t.primary.fill : t.soft;
  const ink = t.outlined ? t.text : earned ? t.primary.ink : t.textMuted;
  const Mark = earned ? CheckIcon : LockIcon;
  return (
    <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      <View style={[s.tileBox, { width: size, height: size, backgroundColor: fill }, outline(t)]}>
        <I color={ink} size={size * 0.44} />
      </View>
      <View style={[s.corner, { backgroundColor: earned ? t.primaryText : t.surface, borderColor: earned ? t.surface : t.border }]}>
        <Mark color={earned ? t.background : t.textMuted} size={14} />
      </View>
      {earned && a.level > 1 ? (
        <View style={[s.levelPill, { backgroundColor: t.surface, borderColor: t.border }]}>
          <Text style={[type.tab, { color: t.text }]}>×{a.level}</Text>
        </View>
      ) : null}
    </View>
  );
}

/** Başarım kutucuğu (ızgara hücresi): karo + kısa ad; kilitlide ince çubuk ve oran. Dokununca ayrıntı. */
export function AchievementTile({ achievement: a, onPress }: { achievement: Achievement; onPress: () => void }) {
  const t = useSweetTheme();
  const { t: tr, lang } = useT();
  const title = achievementTitle(a, tr, lang);
  const target = achievementTarget(a);
  return (
    <SoftPressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={achievementLabel(a, tr, lang)}
      accessibilityHint={tr('ach.openHint')}
      style={s.tile}>
      <AchievementIcon achievement={a} />
      <Text style={[type.bubble, { color: a.level > 0 ? t.text : t.textMuted, textAlign: 'center' }]} numberOfLines={2}>
        {title}
      </Text>
      {a.level === 0 ? (
        <View style={{ alignSelf: 'stretch', gap: 2 }} importantForAccessibility="no-hide-descendants">
          <ProgressBar compact value={a.current} max={target} label={title} />
          <Text style={[type.tab, { color: t.textMuted, textAlign: 'center' }]}>
            {a.current}/{target}
          </Text>
        </View>
      ) : null}
    </SoftPressable>
  );
}

/** Başarım ayrıntısı (alt panel içeriği): büyük karo, cümle, durum. */
export function AchievementDetail({ achievement: a }: { achievement: Achievement }) {
  const t = useSweetTheme();
  const { t: tr, lang } = useT();
  const target = achievementTarget(a);
  const name = a.subject ? loc(a.subject.name, lang) : '';
  const date = a.earnedAt ? new Date(a.earnedAt).toLocaleDateString(lang, { dateStyle: 'long' }) : null;
  return (
    <View style={{ alignItems: 'center', gap: space.lg, paddingVertical: space.md, paddingHorizontal: space.xl }}>
      <AchievementIcon achievement={a} size={104} />
      <Text style={[type.body, { color: t.text, textAlign: 'center' }]}>{tr(`ach.${a.kind}.body`, { n: target, name })}</Text>
      {a.level > 0 ? (
        <View style={s.row} accessible accessibilityLabel={`${tr('ach.earnedStatus')}${date ? `, ${date}` : ''}`}>
          <CheckIcon color={t.primaryText} size={18} />
          <Text style={[type.meta, { color: t.text }]}>{date ?? tr('ach.earnedStatus')}</Text>
        </View>
      ) : (
        <View style={{ alignSelf: 'stretch' }}>
          <ProgressBar value={a.current} max={target} label={achievementTitle(a, tr, lang)} />
        </View>
      )}
    </View>
  );
}

/** Kutlama anı: içerik bir kez "basılır" (1,25 → 1 ölçek, opacity). Reduce motion: yalnız opacity. */
export function PopIn({ children }: { children: ReactNode }) {
  const reduced = useReducedMotion();
  const scale = useSharedValue(reduced ? 1 : 1.25);
  const opacity = useSharedValue(0);
  useEffect(() => {
    opacity.set(withTiming(1, { duration: reduced ? duration.fade : duration.enter }));
    if (!reduced) scale.set(withTiming(1, { duration: duration.sheetIn, easing: ease.out }));
  }, [reduced, scale, opacity]);
  const animated = useAnimatedStyle(() => ({ opacity: opacity.value, transform: [{ scale: scale.value }] }));
  return <Animated.View style={animated}>{children}</Animated.View>;
}

/**
 * Görünürlük seçimi: simgeli seçenek kutucukları (radyo grubu). Seçili: firuze dolgu + kalın yazı + tik;
 * `layout="stack"` büyük kartlar (gizlilik), `row` yan yana kompakt (fotoğraf).
 */
export function VisibilityChoice({
  value,
  onChange,
  label,
  labels,
  layout = 'row',
}: {
  value: Visibility;
  onChange: (v: Visibility) => void;
  label: string;
  labels: Record<Visibility, string>;
  layout?: 'row' | 'stack';
}) {
  const t = useSweetTheme();
  const { fontScale } = useWindowDimensions();
  const stack = layout === 'stack' || fontScale >= 1.5;
  const options: Visibility[] = ['private', 'friends', 'public'];
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label} style={{ flexDirection: stack ? 'column' : 'row', gap: space.sm }}>
      {options.map((option) => {
        const on = option === value;
        const I = VISIBILITY_ICONS[option];
        const fg = on && !t.outlined ? t.primary.ink : t.text;
        return (
          <SoftPressable
            key={option}
            onPress={() => {
              if (on) return;
              selectionHaptic();
              onChange(option);
            }}
            accessibilityRole="radio"
            accessibilityLabel={labels[option]}
            accessibilityState={{ checked: on }}
            style={[
              stack ? s.choiceStack : s.choiceRow,
              { backgroundColor: on && !t.outlined ? t.primary.fill : t.soft },
              outline(t),
              on && t.outlined && { borderWidth: 3 },
            ]}>
            <I color={fg} size={stack ? 24 : 26} />
            <Text
              style={[
                type.bubble,
                { color: fg, fontFamily: on ? type.button.fontFamily : type.bubble.fontFamily, textAlign: stack ? 'left' : 'center' },
                stack && { flex: 1, fontSize: 17, lineHeight: 22 },
              ]}
              numberOfLines={2}>
              {labels[option]}
            </Text>
            {on ? (
              <View style={stack ? null : s.choiceCheck}>
                <CheckIcon color={fg} size={18} />
              </View>
            ) : null}
          </SoftPressable>
        );
      })}
    </View>
  );
}

/** Görünürlük → simge (web'de Lock / Users / Globe). */
export const VISIBILITY_ICONS: Record<Visibility, Icon> = { private: LockIcon, friends: UsersIcon, public: GlobeIcon };

/** Fotoğrafın durumu: görünürlük + (herkese açıksa) inceleme + arşiv. Simge ve metin listesi. */
export function photoStatus(photo: UserPhoto, tr: Translate): { icon: Icon; label: string }[] {
  const out: { icon: Icon; label: string }[] = [{ icon: VISIBILITY_ICONS[photo.visibility], label: tr(`photos.vis.${photo.visibility}`) }];
  if (photo.visibility === 'public') {
    const review = { none: ClockIcon, pending: ClockIcon, approved: CheckIcon, rejected: CloseIcon }[photo.review];
    out.push({ icon: review, label: tr(`photos.review.${photo.review}`) });
  }
  if (photo.archive === 'accepted' || photo.archive === 'suggested') {
    out.push({ icon: ArchiveIcon, label: tr(`photos.archive.${photo.archive}`) });
  }
  return out;
}

/** Fotoğraf köşesindeki durum simgeleri (yüzey renginde yuvarlak); anlamı üst öğenin etiketinde. */
export function StatusDots({ items }: { items: { icon: Icon; label: string }[] }) {
  const t = useSweetTheme();
  return (
    <View style={s.dots} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      {items.map(({ icon: I, label }) => (
        <View key={label} style={[s.dot, { backgroundColor: t.surface, borderColor: t.border }]}>
          <I color={t.text} size={14} />
        </View>
      ))}
    </View>
  );
}

/** Seçim hissi: seçenek kartları ve sekmelerde. */
export function selectionHaptic() {
  void Haptics.selectionAsync();
}

const s = StyleSheet.create({
  stamp: { borderRadius: radius.md, borderCurve: 'continuous', alignItems: 'center', justifyContent: 'center', padding: 6 },
  stampRing: {
    flex: 1,
    alignSelf: 'stretch',
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dashed: { borderWidth: 2, borderStyle: 'dashed' },
  art: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.md, minHeight: 96 },
  circle: { alignItems: 'center', justifyContent: 'center', borderWidth: 3, overflow: 'hidden' },
  invite: { alignItems: 'center', gap: space.lg, paddingVertical: space.xl, paddingHorizontal: space.lg },
  strip: { flexDirection: 'row', gap: space.sm },
  stat: { flex: 1, minWidth: 0, alignItems: 'flex-start', gap: 2, padding: space.md, borderRadius: radius.md, borderCurve: 'continuous' },
  statValue: { fontFamily: type.screenTitle.fontFamily, fontSize: 26, lineHeight: 32 },
  tile: { flex: 1, alignItems: 'center', gap: space.sm, minHeight: 96, paddingVertical: space.sm },
  tileBox: { borderRadius: radius.lg, borderCurve: 'continuous', alignItems: 'center', justifyContent: 'center' },
  corner: {
    position: 'absolute',
    right: -4,
    top: -4,
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  levelPill: { position: 'absolute', left: -4, bottom: -4, paddingHorizontal: 6, borderRadius: 10, borderWidth: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  dots: { position: 'absolute', top: 6, right: 6, flexDirection: 'row', gap: 4 },
  dot: { width: 26, height: 26, borderRadius: 13, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  choiceRow: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xs,
    minHeight: 76,
    paddingVertical: space.md,
    paddingHorizontal: space.xs,
    borderRadius: radius.md,
    borderCurve: 'continuous',
  },
  choiceStack: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    minHeight: 60,
    paddingHorizontal: space.lg,
    borderRadius: radius.md,
    borderCurve: 'continuous',
  },
  choiceCheck: { position: 'absolute', top: 6, right: 6 },
});

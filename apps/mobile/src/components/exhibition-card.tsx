import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { Badge, softShadow } from '@/components/ui';
import { ExternalIcon } from '@/design/icons';
import { radius, space, type } from '@/design/type';
import { useSeziTheme } from '@/hooks/use-sezi-theme';
import { useT } from '@/lib/i18n';
import { loc, type ExhibitionRow } from '@/lib/works';

function formatDate(iso: string, lang: 'tr' | 'en') {
  return new Date(iso).toLocaleDateString(lang === 'tr' ? 'tr-TR' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

/** Envanter fotoğraflarıyla açılmış bir sergi: ad, mekân, tarih, fotoğraf sayısı ve duyuru bağlantısı. */
export function ExhibitionCard({ exhibition: e }: { exhibition: ExhibitionRow }) {
  const t = useSeziTheme();
  const { t: tr, lang } = useT();
  const today = new Date().toISOString().slice(0, 10);
  const ongoing = !!e.starts_on && e.starts_on <= today && (!e.ends_on || e.ends_on >= today);
  const dates = e.starts_on
    ? e.ends_on
      ? tr('exh.dates', { from: formatDate(e.starts_on, lang), to: formatDate(e.ends_on, lang) })
      : tr('exh.from', { from: formatDate(e.starts_on, lang) })
    : '';
  const title = loc(e.title, lang);
  const body = (
    <>
      <View style={styles.head}>
        <Text style={[type.title, { color: t.text, fontSize: 22, lineHeight: 28, flex: 1 }]}>{title}</Text>
        {ongoing ? <Badge label={tr('exh.ongoing')} tone="primary" /> : null}
      </View>
      <Text style={[type.body, { color: t.text }]}>{loc(e.venue, lang)}</Text>
      <Text style={[type.meta, { color: t.textMuted }]}>{[dates, e.photo_count ? tr('exh.photos', { n: e.photo_count }) : null].filter(Boolean).join(' · ')}</Text>
      {e.description ? <Text style={[type.meta, { color: t.textMuted }]}>{loc(e.description, lang)}</Text> : null}
      {e.source_url ? (
        <View style={styles.link}>
          <ExternalIcon color={t.primary} />
          <Text style={[type.button, { color: t.primary, fontSize: 15 }]}>{tr('exh.source')}</Text>
        </View>
      ) : null}
    </>
  );
  const cardStyle = [styles.card, softShadow(t), { backgroundColor: t.surface }];
  if (!e.source_url) return <View style={cardStyle}>{body}</View>;
  return (
    <Pressable
      onPress={() => Linking.openURL(e.source_url!)}
      accessibilityRole="link"
      accessibilityLabel={`${title}. ${loc(e.venue, lang)}. ${dates}`}
      accessibilityHint={tr('exh.source')}
      style={({ pressed }) => [...cardStyle, pressed && { backgroundColor: t.background }]}>
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { gap: space.sm, padding: space.lg, borderRadius: radius.xl },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
  link: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.xs },
});

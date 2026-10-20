import { loc, type ExhibitionRow } from '@sezi/shared';
import { Linking, StyleSheet, Text, View } from 'react-native';

import { Badge } from '@/components/ui';
import { ExternalIcon } from '@/design/icons';
import { outline, SoftPressable } from '@/design/sweet/components';
import { radius, space, type } from '@/design/type';
import { useSweetTheme } from '@/hooks/use-sweet-theme';
import { useT } from '@/lib/i18n';

function formatDate(iso: string, lang: 'tr' | 'en') {
  return new Date(iso).toLocaleDateString(lang === 'tr' ? 'tr-TR' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

/** Envanter fotoğraflarıyla açılmış bir sergi: ad, mekân, tarih, fotoğraf sayısı ve duyuru bağlantısı. */
export function ExhibitionCard({ exhibition: e }: { exhibition: ExhibitionRow }) {
  const t = useSweetTheme();
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
        <Text style={[type.title, { color: t.text, flex: 1 }]}>{title}</Text>
        {ongoing ? <Badge label={tr('exh.ongoing')} tone="primary" /> : null}
      </View>
      <Text style={[type.body, { color: t.text }]}>{loc(e.venue, lang)}</Text>
      <Text style={[type.meta, { color: t.textMuted }]}>{[dates, e.photo_count ? tr('exh.photos', { n: e.photo_count }) : null].filter(Boolean).join(' · ')}</Text>
      {e.description ? <Text style={[type.meta, { color: t.textMuted }]}>{loc(e.description, lang)}</Text> : null}
      {e.source_url ? (
        <View style={styles.link}>
          <ExternalIcon color={t.primaryText} />
          <Text style={[type.button, { color: t.primaryText, fontSize: 15 }]}>{tr('exh.source')}</Text>
        </View>
      ) : null}
    </>
  );
  const cardStyle = [styles.card, { backgroundColor: t.surface }, outline(t)];
  if (!e.source_url) return <View style={cardStyle}>{body}</View>;
  return (
    <SoftPressable
      onPress={() => Linking.openURL(e.source_url!)}
      accessibilityRole="link"
      accessibilityLabel={`${title}. ${loc(e.venue, lang)}. ${dates}`}
      accessibilityHint={tr('exh.source')}
      style={cardStyle}>
      {body}
    </SoftPressable>
  );
}

const styles = StyleSheet.create({
  card: { gap: space.sm, padding: space.lg, borderRadius: radius.lg, borderCurve: 'continuous' },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
  link: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.xs },
});

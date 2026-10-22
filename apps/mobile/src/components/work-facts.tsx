import { bookPageUrl, inventorySource, loc, type SweetTheme, type WorkRow } from '@sezi/shared';
import { Linking, StyleSheet, Text, View } from 'react-native';

import { Card, ListRow } from '@/components/ui';
import { ExternalIcon } from '@/design/icons';
import { space, type } from '@/design/type';
import { useT } from '@/lib/i18n';

interface FactSource {
  title: string;
  ref: string | null;
  url: string | null;
}

/**
 * Bilgi kartı: kısa satırlar (tür, ilçe, yapım, banisi, dönem, durum). Her satırın yanında hangi kaynaktan geldiğini
 * gösteren numara; numaralar kartın altında kitabın o sayfasını açan satırlarla eşleşir. Yapım/bani/dönem yalnız
 * admin kitap sayfasıyla karşılaştırıp yayınladıysa gelir (`facts_source`); tür ve ilçe envanter kaydından.
 */
export function WorkFacts({ work, t }: { work: WorkRow; t: SweetTheme }) {
  const { t: tr, lang } = useT();
  const inv = inventorySource(work);
  const fs = work.facts_source;
  const refOf = (volume: number | null | undefined, page: string | null | undefined) =>
    page ? (volume ? tr('inv.refShort', { v: volume, page }) : tr('inv.refPage', { page })) : null;

  // Bilgi kartı kitabın envanter kaydıyla aynı kitaptan geliyorsa tek kaynak: kaydın tam sayfa aralığı ve PDF sayfası.
  const factsSrc: FactSource | null = fs ? { title: fs.title, ref: refOf(fs.volume, fs.page), url: fs.url ? bookPageUrl(fs.url, fs.pdf_page) : null } : null;
  const invSrc: FactSource | null = inv ? { title: inv.title, ref: refOf(inv.volume, inv.page), url: inv.url ?? null } : null;
  const sameBook = factsSrc && invSrc && factsSrc.title === invSrc.title;
  const sources = (sameBook ? [factsSrc] : [invSrc, factsSrc]).filter((x): x is FactSource => x !== null);
  const invN = invSrc ? 1 : null;
  const factsN = factsSrc ? (sameBook || !invSrc ? 1 : 2) : null;

  const rows: { key: string; label: string; value: string; n: number | null }[] = [
    { key: 'type', label: tr('work.fact.type'), value: loc(work.type_name, lang), n: invN },
    { key: 'district', label: tr('work.fact.district'), value: work.district ?? '', n: invN },
    { key: 'built', label: tr('work.fact.built'), value: work.built_year ? String(work.built_year) : '', n: factsN },
    { key: 'founder', label: tr('work.fact.founder'), value: work.founder ?? '', n: factsN },
    { key: 'period', label: tr('work.fact.period'), value: loc(work.period, lang), n: factsN },
    { key: 'condition', label: tr('work.fact.condition'), value: work.condition === 'unknown' ? '' : tr(`work.condition.${work.condition}`), n: null },
  ].filter((r) => r.value);
  const missingFacts = !work.built_year && !work.founder;

  return (
    <View style={{ gap: space.md }}>
      <Card padded={false}>
        <View style={s.rows}>
          {rows.map((r) => (
            <View
              key={r.key}
              style={s.row}
              accessible
              accessibilityLabel={[`${r.label}: ${r.value}`, r.n ? tr('work.factSourceA11y', { n: r.n, title: sources[r.n - 1]!.title }) : null].filter(Boolean).join('. ')}>
              <Text style={[type.meta, s.label, { color: t.textMuted }]}>{r.label}</Text>
              <Text style={[type.itemTitle, s.value, { color: t.text }]}>{r.value}</Text>
              {r.n ? <SourceMark n={r.n} t={t} /> : <View style={s.markSpace} />}
            </View>
          ))}
        </View>
        {sources.map((src, i) => (
          <ListRow
            key={`${src.title}${src.ref}`}
            leading={<SourceMark n={i + 1} t={t} />}
            title={src.title}
            subtitle={src.ref ?? undefined}
            hint={src.url ? tr('work.factSourceHint') : undefined}
            onPress={src.url ? () => void Linking.openURL(src.url!) : undefined}
            trailing={src.url ? <ExternalIcon color={t.primaryText} /> : null}
          />
        ))}
      </Card>
      {missingFacts ? <Text style={[type.meta, { color: t.textMuted }]}>{tr('work.factsPending')}</Text> : null}
    </View>
  );
}

/** Kaynak numarası: renkten bağımsız (rakam + çerçeve). */
function SourceMark({ n, t }: { n: number; t: SweetTheme }) {
  return (
    <View style={[s.mark, { borderColor: t.textMuted }]} accessible={false}>
      <Text style={[type.bubble, { color: t.textMuted, fontSize: 12, lineHeight: 16 }]}>{n}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  rows: { paddingHorizontal: space.lg, paddingVertical: space.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 44, paddingVertical: space.xs },
  label: { width: '32%' },
  value: { flex: 1 },
  mark: { width: 22, height: 22, borderRadius: 11, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  markSpace: { width: 22 },
});

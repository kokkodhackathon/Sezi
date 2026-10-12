import type { ThemeColors } from '@sezi/shared';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Badge, Button, Card, EmptyState, Note } from '@/components/ui';
import { InfoIcon } from '@/design/icons';
import { space, type } from '@/design/type';
import { useSeziTheme } from '@/hooks/use-sezi-theme';
import { useT, type MessageKey } from '@/lib/i18n';
import { useReports } from '@/lib/reports';
import { loc, useWorks } from '@/lib/works';

export default function Reports() {
  const t = useSeziTheme();
  const s = useMemo(() => makeStyles(t), [t]);
  const { t: tr, lang } = useT();
  const reports = useReports();
  const { data: works } = useWorks();
  const nameOf = (slug: string) => {
    const w = works?.find((x) => x.slug === slug);
    return w ? loc(w.name, lang) : slug;
  };
  const queued = reports.some((r) => r.status === 'queued');

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.body}>
      {reports.length === 0 ? (
        <EmptyState title={tr('reports.empty')} body={tr('reports.emptyBody')} />
      ) : (
        <>
          {queued ? (
            <View style={{ gap: space.md }}>
              <Note text={tr('reports.queuedHelp')} icon={<InfoIcon color={t.textMuted} />} />
              <Button label={tr('profile.signIn')} variant="outline" onPress={() => router.push('/sign-in')} />
            </View>
          ) : null}
          {reports.map((r) => {
            const tone = r.status === 'approved' ? 'primary' : r.status === 'rejected' ? 'danger' : r.status === 'pending' ? 'accent' : 'neutral';
            const date = new Date(r.createdAt).toLocaleDateString(lang === 'tr' ? 'tr-TR' : 'en-GB', { day: 'numeric', month: 'long' });
            return (
              <Card key={r.id} style={{ gap: space.sm }}>
                <View style={s.head}>
                  <Text style={[type.itemTitle, { color: t.text, flex: 1 }]}>{tr(`report.type.${r.type}` as MessageKey)}</Text>
                  <Badge label={tr(`reports.${r.status}` as MessageKey)} tone={tone} />
                </View>
                <Text style={[type.meta, { color: t.textMuted }]}>
                  {tr('report.near', { name: nameOf(r.workSlug) })} · {date}
                </Text>
                {r.note ? <Text style={[type.body, { color: t.text }]}>{r.note}</Text> : null}
              </Card>
            );
          })}
        </>
      )}
    </ScrollView>
  );
}

const makeStyles = (t: ThemeColors) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.background },
    body: { padding: space.lg, gap: space.md, paddingBottom: 56 },
    head: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  });

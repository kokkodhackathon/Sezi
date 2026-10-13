import { useMemo } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text } from 'react-native';

import { ExhibitionCard } from '@/components/exhibition-card';
import { Eyebrow } from '@/components/ui';
import { space, type } from '@/design/type';
import { useSeziTheme } from '@/hooks/use-sezi-theme';
import { useT } from '@/lib/i18n';
import { useExhibitions } from '@/lib/works';

export default function Exhibitions() {
  const t = useSeziTheme();
  const { t: tr } = useT();
  const { data, isLoading } = useExhibitions();
  const s = useMemo(() => StyleSheet.create({ screen: { flex: 1, backgroundColor: t.background }, body: { padding: space.xl, gap: space.lg, paddingBottom: 56 } }), [t]);
  return (
    <ScrollView style={s.screen} contentContainerStyle={s.body}>
      <Eyebrow text={tr('exh.eyebrow')} />
      <Text style={[type.body, { color: t.text }]}>{tr('about.projectBody')}</Text>
      {isLoading ? <ActivityIndicator color={t.primary} /> : null}
      {(data ?? []).map((e) => (
        <ExhibitionCard key={e.id} exhibition={e} />
      ))}
    </ScrollView>
  );
}

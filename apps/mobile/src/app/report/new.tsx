import type { ThemeColors } from '@sezi/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button, Card, EmptyState, Field, Note } from '@/components/ui';
import { InfoIcon } from '@/design/icons';
import { radius, space, type } from '@/design/type';
import { WorkGlyph } from '@/design/work-glyph';
import { useSeziTheme } from '@/hooks/use-sezi-theme';
import { useT, type MessageKey } from '@/lib/i18n';
import { landmarkNodeForWork, nearestSegmentId } from '@/lib/nav';
import { addReport } from '@/lib/reports';
import { loc, useWork } from '@/lib/works';

const TYPES = ['stairs', 'ramp_blocked', 'narrow_path', 'surface_damage', 'construction', 'other'] as const;

export default function NewReport() {
  const { work: slug } = useLocalSearchParams<{ work: string }>();
  const t = useSeziTheme();
  const s = useMemo(() => makeStyles(t), [t]);
  const { t: tr, lang } = useT();
  const { data: work } = useWork(slug);
  const [kind, setKind] = useState<(typeof TYPES)[number] | null>(null);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const name = work ? loc(work.name, lang) : '';

  const submit = () => {
    if (!kind) return setError(tr('report.needType'));
    const node = landmarkNodeForWork(slug);
    const point = node?.location ?? (work ? ([work.lng, work.lat] as [number, number]) : null);
    if (!point) return;
    addReport({ segmentId: nearestSegmentId(point), type: kind, note: note.trim() || undefined, workSlug: slug });
    setSent(true);
  };

  if (sent) {
    return (
      <View style={s.done}>
        <EmptyState
          title={tr('report.sent')}
          body={tr('report.sentBody')}
          action={
            <View style={{ gap: space.sm, alignSelf: 'stretch' }}>
              <Button label={tr('report.toReports')} onPress={() => router.replace('/reports')} />
              <Button label={tr('common.close')} variant="ghost" onPress={() => router.back()} />
            </View>
          }
        />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={s.screen} contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
        <Text style={[type.body, { color: t.text }]}>{tr('report.lead')}</Text>

        <View style={{ gap: space.sm }}>
          <Text style={[type.itemTitle, { color: t.text, fontSize: 16 }]}>{tr('report.where')}</Text>
          <Card style={s.where}>
            {work ? <WorkGlyph slug={work.type_slug} size={40} /> : null}
            <Text style={[type.body, { color: t.text, flex: 1 }]}>{tr('report.near', { name })}</Text>
          </Card>
        </View>

        <View style={{ gap: space.sm }} accessibilityRole="radiogroup" accessibilityLabel={tr('report.type')}>
          <Text style={[type.itemTitle, { color: t.text, fontSize: 16 }]}>{tr('report.type')}</Text>
          <View style={s.grid}>
            {TYPES.map((k) => {
              const on = kind === k;
              return (
                <Pressable
                  key={k}
                  onPress={() => {
                    setKind(k);
                    setError(null);
                  }}
                  accessibilityRole="radio"
                  accessibilityLabel={tr(`report.type.${k}` as MessageKey)}
                  accessibilityState={{ checked: on }}
                  style={[s.option, { borderColor: on ? t.primary : t.border, borderWidth: on ? 2 : 1, backgroundColor: on ? t.background : t.surface }]}>
                  <View style={[s.radio, { borderColor: on ? t.primary : t.textMuted, backgroundColor: on ? t.primary : 'transparent' }]} />
                  <Text style={[type.itemTitle, { color: t.text, fontSize: 16, flex: 1 }]}>{tr(`report.type.${k}` as MessageKey)}</Text>
                </Pressable>
              );
            })}
          </View>
          {error ? (
            <Text style={[type.meta, { color: t.danger }]} accessibilityLiveRegion="assertive">
              {error}
            </Text>
          ) : null}
        </View>

        <Field label={tr('report.note')} help={tr('report.noteHelp')} value={note} onChangeText={setNote} multiline maxLength={500} />

        <View style={{ gap: space.sm }}>
          <Button label={tr('report.photo')} variant="outline" onPress={() => {}} disabled hint={tr('report.photoHelp')} />
          <Text style={[type.meta, { color: t.textMuted }]}>{tr('report.photoHelp')}</Text>
        </View>

        <Note text={tr('reports.queuedHelp')} icon={<InfoIcon color={t.textMuted} />} />
        <Button label={tr('report.submit')} onPress={submit} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const makeStyles = (t: ThemeColors) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.background },
    body: { padding: space.xl, gap: space.xl, paddingBottom: 56 },
    done: { flex: 1, padding: space.lg, justifyContent: 'center', backgroundColor: t.background },
    where: { flexDirection: 'row', alignItems: 'center', gap: space.md },
    grid: { gap: space.sm },
    option: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 56, paddingHorizontal: space.lg, borderRadius: radius.md },
    radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2 },
  });

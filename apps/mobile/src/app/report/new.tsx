import type { SweetTheme } from '@sezi/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button, Card, EmptyState, Field, Note } from '@/components/ui';
import { CheckIcon, InfoIcon } from '@/design/icons';
import { outline, SoftPressable } from '@/design/sweet/components';
import { toneForType } from '@/design/sweet/tones';
import { font, radius, space, type } from '@/design/type';
import { WorkGlyphInline } from '@/design/work-glyph';
import { useSweetTheme } from '@/hooks/use-sweet-theme';
import { useT, type MessageKey } from '@/lib/i18n';
import { landmarkNodeForWork, nearestSegmentId } from '@/lib/nav';
import { addReport } from '@/lib/reports';
import { loc, useWork } from '@/lib/works';

const TYPES = ['stairs', 'ramp_blocked', 'narrow_path', 'surface_damage', 'construction', 'other'] as const;

export default function NewReport() {
  const { work: slug } = useLocalSearchParams<{ work: string }>();
  const t = useSweetTheme();
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
            {work ? (
              <View
                importantForAccessibility="no-hide-descendants"
                accessibilityElementsHidden
                style={[s.glyph, { backgroundColor: t.tones[toneForType(work.type_slug)].fill }, outline(t)]}>
                <WorkGlyphInline slug={work.type_slug} color={t.tones[toneForType(work.type_slug)].ink} size={22} />
              </View>
            ) : null}
            <Text style={[type.body, { color: t.text, flex: 1 }]}>{tr('report.near', { name })}</Text>
          </Card>
        </View>

        <View style={{ gap: space.sm }} accessibilityRole="radiogroup" accessibilityLabel={tr('report.type')}>
          <Text style={[type.itemTitle, { color: t.text, fontSize: 16 }]}>{tr('report.type')}</Text>
          <View style={s.grid}>
            {TYPES.map((k) => {
              const on = kind === k;
              const fg = on ? t.primary.ink : t.text;
              return (
                <SoftPressable
                  key={k}
                  onPress={() => {
                    setKind(k);
                    setError(null);
                  }}
                  accessibilityRole="radio"
                  accessibilityLabel={tr(`report.type.${k}` as MessageKey)}
                  accessibilityState={{ checked: on }}
                  style={[
                    s.option,
                    { backgroundColor: on ? t.primary.fill : t.surface },
                    outline(t),
                    on && t.outlined && { borderWidth: 3 },
                  ]}>
                  <View
                    style={[
                      s.radio,
                      { borderColor: on ? t.primary.ink : t.textMuted, backgroundColor: on ? t.primary.ink : 'transparent' },
                    ]}>
                    {on ? <CheckIcon color={t.primary.fill} size={14} /> : null}
                  </View>
                  <Text style={[type.itemTitle, { color: fg, fontSize: 16, flex: 1 }, on && { fontFamily: font.roundHeavy }]}>
                    {tr(`report.type.${k}` as MessageKey)}
                  </Text>
                </SoftPressable>
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

const makeStyles = (t: SweetTheme) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.background },
    body: { padding: space.xl, gap: space.xl, paddingBottom: 56 },
    done: { flex: 1, padding: space.lg, justifyContent: 'center', backgroundColor: t.background },
    where: { flexDirection: 'row', alignItems: 'center', gap: space.md },
    glyph: { width: 40, height: 40, borderRadius: radius.sm, borderCurve: 'continuous', alignItems: 'center', justifyContent: 'center' },
    grid: { gap: space.sm },
    option: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 56, paddingHorizontal: space.lg, borderRadius: radius.md, borderCurve: 'continuous' },
    radio: { width: 24, height: 24, borderRadius: 12, borderCurve: 'continuous', borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  });

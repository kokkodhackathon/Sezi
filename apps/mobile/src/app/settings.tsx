import type { SweetTheme } from '@sezi/shared';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button, Card, ListRow, Note, SectionTitle, Segmented, ToggleRow } from '@/components/ui';
import { InfoIcon, PlayIcon } from '@/design/icons';
import { space, type } from '@/design/type';
import { useSweetTheme } from '@/hooks/use-sweet-theme';
import { useT } from '@/lib/i18n';
import { useProfile } from '@/lib/profile';
import { useSettings } from '@/lib/settings';
import { usePassport } from '@/lib/passport';
import { NARRATION_WAIT_MS, say } from '@/lib/voice/speech';

export default function SettingsScreen() {
  const t = useSweetTheme();
  const s = useMemo(() => makeStyles(t), [t]);
  const { t: tr, lang } = useT();
  const { settings, update } = useSettings();
  const { count, clear } = usePassport();
  const { profile, resetProfile } = useProfile();
  const confirm = (title: string, action: () => void) =>
    Alert.alert(title, `${tr('settings.confirm')} ${tr('settings.confirmBody')}`, [
      { text: tr('common.cancel'), style: 'cancel' },
      { text: tr('settings.confirmYes'), style: 'destructive', onPress: action },
    ]);

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.body}>
      <SectionTitle title={tr('settings.appearance')} />
      <View style={{ gap: space.sm }}>
        <Text style={[type.itemTitle, { color: t.text, fontSize: 16 }]}>{tr('settings.theme')}</Text>
        <Segmented
          label={tr('settings.theme')}
          value={settings.themeMode}
          onChange={(v) => update({ themeMode: v })}
          options={[
            { value: 'system', label: tr('settings.theme.system') },
            { value: 'light', label: tr('settings.theme.light') },
            { value: 'dark', label: tr('settings.theme.dark') },
          ]}
        />
        {profile?.vision === 'low' ? <Note text={tr('settings.contrastNote')} icon={<InfoIcon color={t.textMuted} />} /> : null}
      </View>

      <SectionTitle title={tr('settings.guidance')} />
      <View style={{ gap: space.sm }}>
        <Text style={[type.itemTitle, { color: t.text, fontSize: 16 }]}>{tr('settings.speech')}</Text>
        <Segmented
          label={tr('settings.speech')}
          value={settings.speechRate}
          onChange={(v) => update({ speechRate: v })}
          options={[
            { value: 0.75, label: tr('settings.speech.slow') },
            { value: 0.95, label: tr('settings.speech.normal') },
            { value: 1.2, label: tr('settings.speech.fast') },
          ]}
        />
        <Button
          compact
          variant="outline"
          label={tr('settings.speechTest')}
          icon={(c) => <PlayIcon color={c} size={18} />}
          onPress={() => {
            say(tr('settings.speechSample'), { lang, rate: settings.speechRate, interrupt: true, waitMs: NARRATION_WAIT_MS });
          }}
        />
      </View>
      <View style={{ gap: space.sm }}>
        <Text style={[type.itemTitle, { color: t.text, fontSize: 16 }]}>{tr('settings.storyPlayback')}</Text>
        <Segmented
          label={tr('settings.storyPlayback')}
          value={settings.storyPlayback}
          onChange={(v) => update({ storyPlayback: v })}
          options={[
            { value: 'auto', label: tr('settings.storyAuto') },
            { value: 'tap', label: tr('settings.storyTap') },
          ]}
        />
      </View>

      <Card padded={false}>
        <ListRow first title={tr('profile.edit')} onPress={() => router.push('/onboarding')} />
      </Card>

      <SectionTitle title={tr('dev.title')} />
      <Card padded={false}>
        <ToggleRow
          first
          title={tr('dev.simulation')}
          subtitle={tr('dev.simulationSub')}
          value={settings.devSimulation}
          onChange={(v) => update({ devSimulation: v })}
        />
        {settings.devSimulation ? <ListRow title={tr('settings.device')} subtitle={tr('settings.deviceSub')} onPress={() => router.push('/lab')} /> : null}
      </Card>

      <SectionTitle title={tr('settings.data')} />
      <Card padded={false}>
        <ListRow
          first
          title={tr('settings.clearPassport')}
          subtitle={tr('settings.visitedCount', { n: count })}
          onPress={() =>
            confirm(tr('settings.clearPassport'), () => {
              void clear().catch(() => Alert.alert(tr('account.err.generic')));
            })
          }
        />
        <ListRow title={tr('settings.resetProfile')} subtitle={tr('settings.resetProfileSub')} onPress={() => confirm(tr('settings.resetProfile'), resetProfile)} danger />
      </Card>
    </ScrollView>
  );
}

const makeStyles = (t: SweetTheme) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.background },
    body: { padding: space.xl, gap: space.xl, paddingBottom: 56 },
  });

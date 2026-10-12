import { themes, type ThemeColors, type UserProfile } from '@sezi/shared';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, findNodeHandle, Pressable, ScrollView, StyleSheet, Text, useColorScheme, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { translate, type Lang, type MessageKey } from '@/lib/i18n';
import { defaultSenses, useProfile } from '@/lib/profile';

type Step = 'welcome' | 'lang' | 'vision' | 'mobility' | 'senses' | 'summary';
const STEPS: Step[] = ['welcome', 'lang', 'vision', 'mobility', 'senses', 'summary'];

export default function Onboarding() {
  const { profile, saveProfile } = useProfile();
  const editing = profile !== null;
  const scheme = useColorScheme();

  const [step, setStep] = useState<Step>(editing ? 'lang' : 'welcome');
  const [lang, setLang] = useState<Lang>(profile?.lang ?? 'tr');
  const [vision, setVision] = useState<UserProfile['vision']>(profile?.vision ?? 'full');
  const [mobility, setMobility] = useState<UserProfile['mobility']>(profile?.mobility ?? 'none');
  const [senses, setSenses] = useState<UserProfile['senses']>(profile?.senses ?? defaultSenses('full'));

  // Önizleme: az gören seçilince yüksek kontrast hemen uygulanır.
  const t: ThemeColors = vision === 'low' ? themes.highContrast : themes[scheme === 'dark' ? 'dark' : 'light'];
  const s = useMemo(() => makeStyles(t), [t]);
  const tr = (key: MessageKey, vars?: Record<string, string | number>) => translate(lang, key, vars);

  const steps = editing ? STEPS.filter((x) => x !== 'welcome') : STEPS;
  const index = steps.indexOf(step);
  const titleRef = useRef<Text>(null);

  useEffect(() => {
    // Ekran okuyucu odağını yeni adımın başlığına taşı.
    const node = titleRef.current;
    if (node) {
      const handle = findNodeHandle(node);
      if (handle) AccessibilityInfo.setAccessibilityFocus(handle);
    }
  }, [step]);

  const pickVision = (v: UserProfile['vision']) => {
    setVision(v);
    if (!editing || v !== profile?.vision) setSenses(defaultSenses(v));
  };

  const canContinue = step !== 'senses' || senses.audio || senses.haptic || senses.visual;

  const next = () => {
    if (step === 'summary') {
      saveProfile({ lang, vision, mobility, senses });
      if (editing && router.canGoBack()) router.back();
      else router.replace('/');
      return;
    }
    setStep(steps[index + 1]!);
  };
  const back = () => (index > 0 ? setStep(steps[index - 1]!) : router.canGoBack() && router.back());

  return (
    <SafeAreaView style={s.screen}>
      <View style={s.progress} accessibilityLabel={tr('onb.step', { n: index + 1, total: steps.length })}>
        {steps.map((x, i) => (
          <View key={x} style={[s.progressSeg, { backgroundColor: i <= index ? t.primary : t.border }]} />
        ))}
      </View>

      <ScrollView contentContainerStyle={s.body}>
        <Text style={s.stepLabel} importantForAccessibility="no">
          {tr('onb.step', { n: index + 1, total: steps.length })}
        </Text>

        {step === 'welcome' && (
          <>
            <Text ref={titleRef} style={s.title} accessibilityRole="header">
              {tr('onb.welcome.title')}
            </Text>
            <Text style={s.lead}>{tr('onb.welcome.body')}</Text>
          </>
        )}

        {step === 'lang' && (
          <Question title={tr('onb.lang.title')} titleRef={titleRef} s={s}>
            <Option label="Türkçe" selected={lang === 'tr'} onPress={() => setLang('tr')} t={t} s={s} />
            <Option label="English" selected={lang === 'en'} onPress={() => setLang('en')} t={t} s={s} />
          </Question>
        )}

        {step === 'vision' && (
          <Question title={tr('onb.vision.title')} hint={tr('onb.vision.hint')} titleRef={titleRef} s={s}>
            {(['full', 'low', 'blind'] as const).map((v) => (
              <Option
                key={v}
                label={tr(`onb.vision.${v}`)}
                description={tr(`onb.vision.${v}.d`)}
                selected={vision === v}
                onPress={() => pickVision(v)}
                t={t}
                s={s}
              />
            ))}
          </Question>
        )}

        {step === 'mobility' && (
          <Question title={tr('onb.mobility.title')} hint={tr('onb.mobility.hint')} titleRef={titleRef} s={s}>
            {(['none', 'cane', 'wheelchair'] as const).map((m) => (
              <Option
                key={m}
                label={tr(`onb.mobility.${m}`)}
                description={tr(`onb.mobility.${m}.d`)}
                selected={mobility === m}
                onPress={() => setMobility(m)}
                t={t}
                s={s}
              />
            ))}
          </Question>
        )}

        {step === 'senses' && (
          <Question title={tr('onb.senses.title')} hint={tr('onb.senses.hint')} titleRef={titleRef} s={s} multi>
            {(['audio', 'haptic', 'visual'] as const).map((k) => (
              <Option
                key={k}
                multi
                label={tr(`onb.senses.${k}`)}
                description={tr(`onb.senses.${k}.d`)}
                selected={senses[k]}
                onPress={() => setSenses({ ...senses, [k]: !senses[k] })}
                t={t}
                s={s}
              />
            ))}
            {!canContinue && (
              <Text style={[s.hint, { color: t.danger }]} accessibilityLiveRegion="polite">
                {tr('onb.senses.none')}
              </Text>
            )}
          </Question>
        )}

        {step === 'summary' && (
          <>
            <Text ref={titleRef} style={s.title} accessibilityRole="header">
              {tr('onb.summary.title')}
            </Text>
            {(
              [
                `onb.summary.${mobility}`,
                vision === 'blind' && 'onb.summary.blind',
                vision === 'low' && 'onb.summary.low',
                senses.audio && 'onb.summary.audio',
                senses.haptic && 'onb.summary.haptic',
              ].filter(Boolean) as MessageKey[]
            ).map((key) => (
              <View key={key} style={s.summaryRow}>
                <View style={[s.summaryDot, { backgroundColor: t.accent }]} />
                <Text style={s.lead}>{tr(key)}</Text>
              </View>
            ))}
            <Text style={s.hint}>{tr('onb.summary.change')}</Text>
          </>
        )}
      </ScrollView>

      <View style={s.footer}>
        {index > 0 || editing ? (
          <Pressable onPress={back} accessibilityRole="button" style={({ pressed }) => [s.secondaryBtn, pressed && s.pressed]}>
            <Text style={s.secondaryBtnText}>{tr('onb.back')}</Text>
          </Pressable>
        ) : null}
        <Pressable
          onPress={next}
          disabled={!canContinue}
          accessibilityRole="button"
          accessibilityState={{ disabled: !canContinue }}
          style={({ pressed }) => [s.primaryBtn, !canContinue && s.disabled, pressed && s.pressed]}>
          <Text style={s.primaryBtnText}>{step === 'summary' ? tr('onb.start') : tr('onb.next')}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function Question({
  title,
  hint,
  titleRef,
  s,
  multi,
  children,
}: {
  title: string;
  hint?: string;
  titleRef: React.RefObject<Text | null>;
  s: ReturnType<typeof makeStyles>;
  multi?: boolean;
  children: React.ReactNode;
}) {
  return (
    <>
      <Text ref={titleRef} style={s.title} accessibilityRole="header">
        {title}
      </Text>
      {hint ? <Text style={s.hint}>{hint}</Text> : null}
      <View style={s.options} accessibilityRole={multi ? undefined : 'radiogroup'}>
        {children}
      </View>
    </>
  );
}

function Option({
  label,
  description,
  selected,
  onPress,
  multi,
  t,
  s,
}: {
  label: string;
  description?: string;
  selected: boolean;
  onPress: () => void;
  multi?: boolean;
  t: ThemeColors;
  s: ReturnType<typeof makeStyles>;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={multi ? 'checkbox' : 'radio'}
      accessibilityState={{ checked: selected }}
      accessibilityLabel={description ? `${label}. ${description}` : label}
      style={({ pressed }) => [
        s.option,
        { borderColor: selected ? t.primary : t.border, borderWidth: selected ? 2 : 1 },
        pressed && s.pressed,
      ]}>
      <View
        style={[
          multi ? s.check : s.radio,
          { borderColor: selected ? t.primary : t.textMuted, backgroundColor: selected ? t.primary : 'transparent' },
        ]}>
        {selected ? <Text style={[s.checkMark, { color: t.onPrimary }]}>{multi ? '✓' : ''}</Text> : null}
      </View>
      <View style={s.optionText}>
        <Text style={s.optionLabel}>{label}</Text>
        {description ? <Text style={s.optionDesc}>{description}</Text> : null}
      </View>
    </Pressable>
  );
}

const makeStyles = (t: ThemeColors) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.background },
    progress: { flexDirection: 'row', gap: 6, paddingHorizontal: 20, paddingTop: 12 },
    progressSeg: { flex: 1, height: 4, borderRadius: 2 },
    body: { padding: 20, gap: 16, paddingBottom: 32 },
    stepLabel: { fontSize: 14, fontWeight: '600', color: t.textMuted, letterSpacing: 0.5 },
    title: { fontSize: 30, lineHeight: 36, fontWeight: '700', color: t.text },
    lead: { fontSize: 18, lineHeight: 27, color: t.text, flex: 1 },
    hint: { fontSize: 16, lineHeight: 23, color: t.textMuted },
    options: { gap: 12, marginTop: 4 },
    option: { flexDirection: 'row', gap: 14, alignItems: 'center', padding: 16, borderRadius: 16, backgroundColor: t.surface },
    optionText: { flex: 1, gap: 4 },
    optionLabel: { fontSize: 18, fontWeight: '600', color: t.text },
    optionDesc: { fontSize: 15, lineHeight: 21, color: t.textMuted },
    radio: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
    check: { width: 24, height: 24, borderRadius: 6, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
    checkMark: { fontSize: 15, fontWeight: '800', lineHeight: 18 },
    summaryRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
    summaryDot: { width: 10, height: 10, borderRadius: 5, marginTop: 9 },
    footer: { flexDirection: 'row', gap: 12, paddingHorizontal: 20, paddingVertical: 12, borderTopWidth: 1, borderTopColor: t.border },
    primaryBtn: { flex: 2, minHeight: 56, borderRadius: 16, backgroundColor: t.primary, alignItems: 'center', justifyContent: 'center' },
    primaryBtnText: { fontSize: 18, fontWeight: '700', color: t.onPrimary },
    secondaryBtn: { flex: 1, minHeight: 56, borderRadius: 16, borderWidth: 1, borderColor: t.border, alignItems: 'center', justifyContent: 'center', backgroundColor: t.surface },
    secondaryBtnText: { fontSize: 18, fontWeight: '600', color: t.text },
    disabled: { opacity: 0.4 },
    pressed: { opacity: 0.85 },
  });

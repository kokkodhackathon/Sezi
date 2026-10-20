import { defaultSenses, sweetThemes, type SweetTheme, type UserProfile } from '@sezi/shared';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, findNodeHandle, ScrollView, StyleSheet, Text, useColorScheme, View, type TextStyle, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CheckIcon } from '@/design/icons';
import { CengelMark } from '@/design/motif';
import { FadeInItem, outline, SoftPressable } from '@/design/sweet/components';
import { font, radius, space, type } from '@/design/type';
import { useSettings } from '@/lib/settings';
import { translate, type Lang, type MessageKey } from '@/lib/i18n';
import { useProfile } from '@/lib/profile';

type Step = 'welcome' | 'lang' | 'vision' | 'hearing' | 'mobility' | 'senses' | 'summary';
const STEPS: Step[] = ['welcome', 'lang', 'vision', 'hearing', 'mobility', 'senses', 'summary'];

export default function Onboarding() {
  const { profile, saveProfile } = useProfile();
  const editing = profile !== null;
  const scheme = useColorScheme();
  const { settings } = useSettings();

  const [step, setStep] = useState<Step>(editing ? 'lang' : 'welcome');
  const [lang, setLang] = useState<Lang>(profile?.lang ?? 'tr');
  const [vision, setVision] = useState<UserProfile['vision']>(profile?.vision ?? 'full');
  const [hearing, setHearing] = useState<UserProfile['hearing']>(profile?.hearing ?? 'full');
  const [mobility, setMobility] = useState<UserProfile['mobility']>(profile?.mobility ?? 'none');
  const [senses, setSenses] = useState<UserProfile['senses']>(profile?.senses ?? defaultSenses('full'));

  // Önizleme: az gören seçilince yüksek kontrast hemen uygulanır.
  const t: SweetTheme = vision === 'low' ? sweetThemes.highContrast : sweetThemes[settings.themeMode === 'system' ? (scheme === 'dark' ? 'dark' : 'light') : settings.themeMode];
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
    if (!editing || v !== profile?.vision) setSenses(defaultSenses(v, hearing));
  };
  const pickHearing = (h: UserProfile['hearing']) => {
    setHearing(h);
    if (!editing || h !== profile?.hearing) setSenses(defaultSenses(vision, h));
  };

  const canContinue = step !== 'senses' || senses.audio || senses.haptic || senses.visual;

  const next = () => {
    if (step === 'summary') {
      saveProfile({ lang, vision, hearing, mobility, senses });
      if (editing && router.canGoBack()) router.back();
      else router.replace('/');
      return;
    }
    setStep(steps[index + 1]!);
  };
  const back = () => (index > 0 ? setStep(steps[index - 1]!) : router.canGoBack() && router.back());

  return (
    <SafeAreaView style={s.screen}>
      <StatusBar style={t === sweetThemes.dark ? 'light' : 'dark'} />

      <View style={s.progress} accessibilityLabel={tr('onb.step', { n: index + 1, total: steps.length })}>
        {steps.map((x, i) => (
          <View
            key={x}
            style={[
              s.progressSeg,
              { backgroundColor: i <= index ? t.primary.fill : t.soft },
              t.outlined && {
                borderWidth: 1,
                borderColor: t.border,
                backgroundColor: i <= index ? t.primary.fill : t.background,
              },
            ]}
          />
        ))}
      </View>

      <ScrollView contentContainerStyle={s.body}>
        <Text style={s.stepLabel} importantForAccessibility="no">
          {tr('onb.step', { n: index + 1, total: steps.length })}
        </Text>

        {/* Adım değişince içerik yerinde belirir (8 dp + opacity); ileri/geri yönden bağımsız. */}
        <FadeInItem key={step} index={0} style={s.stepBody}>
        {step === 'welcome' && (
          <View style={s.welcome}>
            <View style={s.medallion}>{!t.outlined ? <CengelMark color={t.primaryText} size={40} /> : null}</View>
            <Text style={[type.hero, { color: t.text }]} accessibilityElementsHidden importantForAccessibility="no">
              Sezi
            </Text>
            <Text ref={titleRef} style={[type.heading, { color: t.primaryText }]} accessibilityRole="header">
              {tr('design.welcome')}
            </Text>

            <Text style={s.hint}>{tr('design.welcomeBody')}</Text>
          </View>
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

        {step === 'hearing' && (
          <Question title={tr('onb.hearing.title')} hint={tr('onb.hearing.hint')} titleRef={titleRef} s={s}>
            {(['full', 'hard', 'deaf'] as const).map((h) => (
              <Option
                key={h}
                label={tr(`onb.hearing.${h}`)}
                description={tr(`onb.hearing.${h}.d`)}
                selected={hearing === h}
                onPress={() => pickHearing(h)}
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
                hearing === 'deaf' && 'onb.summary.deaf',
                hearing === 'hard' && 'onb.summary.hard',
                senses.audio && 'onb.summary.audio',
                senses.haptic && 'onb.summary.haptic',
              ].filter(Boolean) as MessageKey[]
            ).map((key) => (
              <View key={key} style={s.summaryRow}>
                <View style={[s.summaryDot, { backgroundColor: t.accentText }]} />
                <Text style={s.lead}>{tr(key)}</Text>
              </View>
            ))}
            <Text style={s.hint}>{tr('onb.summary.change')}</Text>
          </>
        )}
        </FadeInItem>
      </ScrollView>

      <View style={s.footer}>
        {index > 0 || editing ? (
          <SoftPressable onPress={back} accessibilityRole="button" accessibilityLabel={tr('onb.back')} style={[s.secondaryBtn, outline(t)]}>
            <Text style={s.secondaryBtnText}>{tr('onb.back')}</Text>
          </SoftPressable>
        ) : null}
        <SoftPressable
          onPress={next}
          disabled={!canContinue}
          accessibilityRole="button"
          accessibilityLabel={step === 'summary' ? tr('onb.start') : tr('onb.next')}
          accessibilityState={{ disabled: !canContinue }}
          style={[s.primaryBtn, outline(t), !canContinue && s.disabled]}>
          <Text style={s.primaryBtnText}>{step === 'summary' ? tr('onb.start') : tr('onb.next')}</Text>
        </SoftPressable>
      </View>
    </SafeAreaView>
  );
}

interface QuestionStyles {
  title: TextStyle;
  hint: TextStyle;
  options: ViewStyle;
}

interface OptionStyles {
  option: ViewStyle;
  optionText: ViewStyle;
  optionLabel: TextStyle;
  optionDesc: TextStyle;
  radio: ViewStyle;
  check: ViewStyle;
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
  s: QuestionStyles;
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
  t: SweetTheme;
  s: OptionStyles;
}) {
  const fg = selected ? t.primary.ink : t.text;
  const descFg = selected ? t.primary.ink : t.textMuted;
  return (
    <SoftPressable
      onPress={onPress}
      accessibilityRole={multi ? 'checkbox' : 'radio'}
      accessibilityState={{ checked: selected }}
      accessibilityLabel={description ? `${label}. ${description}` : label}
      style={[
        s.option,
        { backgroundColor: selected ? t.primary.fill : t.surface },
        outline(t),
        selected && t.outlined && { borderWidth: 3 },
      ]}>
      <View
        style={[
          multi ? s.check : s.radio,
          { borderColor: selected ? t.primary.ink : t.textMuted, backgroundColor: selected ? t.primary.ink : 'transparent' },
        ]}>
        {selected ? <CheckIcon color={t.primary.fill} size={16} /> : null}
      </View>
      <View style={s.optionText}>
        <Text style={[s.optionLabel, { color: fg }, selected && { fontFamily: font.roundHeavy }]}>{label}</Text>
        {description ? <Text style={[s.optionDesc, { color: descFg }]}>{description}</Text> : null}
      </View>
    </SoftPressable>
  );
}

const makeStyles = (t: SweetTheme) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.background },
    progress: { flexDirection: 'row', gap: 6, paddingHorizontal: space.xl, paddingTop: space.xl },
    progressSeg: { flex: 1, height: 6, borderRadius: 3, borderCurve: 'continuous' },
    body: { padding: space.xl, gap: space.lg, paddingBottom: space.xxl },
    stepBody: { gap: space.lg },
    welcome: { gap: space.md },
    medallion: { alignItems: 'flex-start', marginBottom: space.lg, marginTop: space.sm },
    stepLabel: { ...type.meta, color: t.primaryText },
    title: { ...type.screenTitle, color: t.text },
    lead: { ...type.lead, color: t.text, flexShrink: 1 },
    hint: { ...type.body, color: t.textMuted },
    options: { gap: space.md, marginTop: space.xs },
    option: { flexDirection: 'row', gap: 14, alignItems: 'center', minHeight: 64, padding: space.lg, borderRadius: radius.lg, borderCurve: 'continuous' },
    optionText: { flex: 1, gap: 4 },
    optionLabel: { ...type.itemTitle, color: t.text },
    optionDesc: { ...type.meta, color: t.textMuted },
    radio: { width: 26, height: 26, borderRadius: 13, borderCurve: 'continuous', borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
    check: { width: 26, height: 26, borderRadius: 8, borderCurve: 'continuous', borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
    summaryRow: { flexDirection: 'row', gap: space.md, alignItems: 'flex-start' },
    summaryDot: { width: 10, height: 10, borderRadius: 2, marginTop: 9, transform: [{ rotate: '45deg' }] },
    footer: { flexDirection: 'row', gap: space.md, paddingHorizontal: space.xl, paddingVertical: space.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.border, backgroundColor: t.background },
    primaryBtn: { flex: 2, minHeight: 54, paddingVertical: space.md, paddingHorizontal: space.xl, borderRadius: radius.md, borderCurve: 'continuous', backgroundColor: t.primary.fill, alignItems: 'center', justifyContent: 'center' },
    primaryBtnText: { ...type.button, color: t.primary.ink },
    secondaryBtn: { flex: 1, minHeight: 54, paddingVertical: space.md, paddingHorizontal: space.lg, borderRadius: radius.md, borderCurve: 'continuous', backgroundColor: t.soft, alignItems: 'center', justifyContent: 'center' },
    secondaryBtnText: { ...type.button, color: t.text },
    disabled: { opacity: 0.4 },
  });

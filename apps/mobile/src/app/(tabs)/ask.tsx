import { loc, searchAskWorks, type AskCitation, type AskHistoryMessage, type SweetTheme, type WorkRow } from '@sezi/shared';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, FlatList, KeyboardAvoidingView, Linking, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { cancelAnimation, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTabBarSpace } from '@/components/app-tabs';
import { ScreenHeader } from '@/components/screen-header';
import { Button, Eyebrow, Note } from '@/components/ui';
import { ChatIcon, ChevronIcon, InfoIcon, PlusIcon, TurnIcon } from '@/design/icons';
import { FadeInItem, IconBubble, outline, SoftPressable, SweetSheet } from '@/design/sweet/components';
import { duration, ease, stagger } from '@/design/sweet/motion';
import { radius, space, type } from '@/design/type';
import { WorkGlyph } from '@/design/work-glyph';
import { useReducedMotion } from '@/hooks/use-reduced-motion';
import { useSweetTheme } from '@/hooks/use-sweet-theme';
import { askSezi } from '@/lib/ask';
import { useT } from '@/lib/i18n';
import { useWorks } from '@/lib/works';

type Message = {
  id: number;
  role: 'user' | 'sezi';
  text: string;
  works?: WorkRow[];
  citations?: AskCitation[];
  mode?: 'rag' | 'insufficient' | 'conversation' | 'local';
};

export default function Ask() {
  const reducedMotion = useReducedMotion();
  const t = useSweetTheme();
  const s = useMemo(() => makeStyles(t), [t]);
  const { t: tr, lang } = useT();
  const { data: works } = useWorks();
  const tabSpace = useTabBarSpace();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sheet, setSheet] = useState<'privacy' | 'reset' | null>(null);
  const [sourceMessage, setSourceMessage] = useState<Message | null>(null);
  const [sourceError, setSourceError] = useState(false);
  const [awayFromBottom, setAwayFromBottom] = useState(false);
  const followBottom = useRef(true);
  const listRef = useRef<FlatList<Message>>(null);
  const nextId = useRef(1);
  const animatedIds = useRef(new Set<number>());
  const [waiting, setWaiting] = useState(false);
  const pending = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  const ask = async (question: string) => {
    const q = question.trim();
    if (!q || pending.current) return;
    pending.current = true;
    followBottom.current = true;
    setAwayFromBottom(false);
    const message: Message = { id: nextId.current++, role: 'user', text: q };
    setMessages((m) => [...m, message]);
    setWaiting(true);
    setInput('');
    AccessibilityInfo.announceForAccessibility(tr('ask.waiting'));
    const history: AskHistoryMessage[] = messages.slice(-6).map((m) => ({ role: m.role === 'user' ? 'user' : 'assistant', text: m.text }));
    const previousWorkSlugs = [...messages].reverse().find((m) => m.role === 'sezi' && m.works?.length)?.works?.map((w) => w.slug) ?? [];
    let answer: Message;
    try {
      const result = await askSezi(q, lang, works ?? [], history, previousWorkSlugs);
      answer = {
        id: nextId.current++,
        role: 'sezi',
        text: result.response.answer,
        works: result.works,
        citations: result.response.citations,
        mode: result.response.mode,
      };
    } catch {
      // İnternet, Edge Function ya da LLM kullanılamıyorsa doğrulanmış kayıtların cihazdaki yerel araması çalışır.
      const found = searchAskWorks(q, works ?? []).slice(0, 10);
      answer = {
        id: nextId.current++,
        role: 'sezi',
        text: found.length ? tr('ask.found', { n: found.length }) : tr('ask.notFound'),
        works: found,
        mode: 'local',
      };
    }
    if (mounted.current) {
      setMessages((m) => [...m, answer]);
      setWaiting(false);
      AccessibilityInfo.announceForAccessibility(answer.text);
    }
    pending.current = false;
  };

  const suggestions = [
    { question: tr('ask.suggest1'), topic: tr('ask.topicHistory'), glyph: 'cami' },
    { question: tr('ask.suggest2'), topic: tr('ask.topicArchitecture'), glyph: 'han' },
    { question: tr('ask.suggest3'), topic: tr('ask.topicExplore'), glyph: 'carsi' },
  ];

  const header = (
    <View style={s.welcome}>
      <View style={[s.welcomeMark, outline(t)]}><ChatIcon color={t.primary.ink} size={32} /></View>
      <Text accessibilityRole="header" style={[type.editorial, { color: t.text }]}>{tr('ask.welcome')}</Text>
      <Text style={[type.body, { color: t.textMuted }]}>{tr('ask.welcomeBody')}</Text>
      <View style={s.suggestions}>
        {suggestions.map(({ question, topic, glyph }, index) => (
          <FadeInItem key={question} index={index}>
            <SoftPressable onPress={() => ask(question)} disabled={waiting} accessibilityRole="button" accessibilityLabel={question} accessibilityState={{ disabled: waiting }} style={[s.suggestion, outline(t)]}>
              <WorkGlyph slug={glyph} size={40} />
              <View style={{ flex: 1, gap: space.xs }}>
                <Text style={[type.meta, { color: t.textMuted }]}>{topic}</Text>
                <Text style={[type.itemTitle, { color: t.text }]}>{question}</Text>
              </View>
              <ChevronIcon color={t.primaryText} size={18} />
            </SoftPressable>
          </FadeInItem>
        ))}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={s.screen} edges={['top']}>
      <View style={s.topBar}>
        <ScreenHeader title={tr('ask.title')} action={
          <View style={{ flexDirection: 'row', gap: space.xs }}>
            <IconBubble label={tr('ask.howTitle')} icon={c => <InfoIcon color={c} />} onPress={() => setSheet('privacy')} />
            {messages.length > 0 && !waiting ? <IconBubble label={tr('ask.newChat')} icon={c => <PlusIcon color={c} />} onPress={() => { if (!pending.current) setSheet('reset'); }} /> : null}
          </View>
        } />
      </View>
      {/* Android uçtan uca çizimde pencere klavyeyle küçülmüyor; yazı alanını klavyenin üstünde tutmak için iki platformda da padding. */}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <FlatList
          ref={listRef}
          keyboardShouldPersistTaps="handled"
          data={messages}
          keyExtractor={(m) => String(m.id)}
          ListEmptyComponent={header}
          contentContainerStyle={[s.list, messages.length === 0 && { flexGrow: 1 }]}
          keyboardDismissMode="on-drag"
          onScroll={({ nativeEvent: e }) => {
            const away = e.contentSize.height - e.layoutMeasurement.height - e.contentOffset.y > 100;
            followBottom.current = !away;
            setAwayFromBottom(away);
          }}
          scrollEventThrottle={100}
          onContentSizeChange={() => { if (messages.length && followBottom.current) listRef.current?.scrollToEnd({ animated: !reducedMotion }); }}
          ListFooterComponent={waiting ? <WaitingIndicator label={tr('ask.waiting')} /> : null}
          renderItem={({ item }) => <MessageReveal id={item.id} eligible={item.id >= nextId.current - 2} animatedIds={animatedIds.current}>{item.role === 'user' ? <UserBubble text={item.text} t={t} label={tr('ask.you')} /> : SeziAnswer({ msg: item, t })}</MessageReveal>}
        />
        {awayFromBottom && messages.length > 0 ? <Button compact label={tr('ask.latest')} variant="secondary" style={{ alignSelf: 'center', marginVertical: space.xs }} onPress={() => { followBottom.current = true; setAwayFromBottom(false); listRef.current?.scrollToEnd({ animated: !reducedMotion }); }} /> : null}
        {/* Yazı alanı yüzen sekme çubuğunun üstünde durur; klavye açıkken çubuk gizli, boşluk küçülür. */}
        <View style={{ marginBottom: Math.max(0, tabSpace - space.lg) }}>
        {messages.length === 0 ? <SoftPressable accessibilityRole="button" accessibilityLabel={tr('ask.privacyShort')} onPress={() => setSheet('privacy')} style={s.privacyLink}>
          <InfoIcon color={t.textMuted} size={16} /><Text style={[type.meta, { color: t.textMuted, flexShrink: 1 }]}>{tr('ask.privacyShort')}</Text>
        </SoftPressable> : null}
        <View style={s.composer}>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder={tr('ask.placeholder')}
            placeholderTextColor={t.textMuted}
            accessibilityLabel={tr('ask.placeholder')}
            returnKeyType="send"
            multiline
            submitBehavior="submit"
            onSubmitEditing={() => ask(input)}
            style={[type.body, s.input]}
            maxLength={240}
          />
          <SoftPressable
            onPress={() => ask(input)}
            disabled={!input.trim() || waiting}
            accessibilityRole="button"
            accessibilityLabel={tr('ask.send')}
            accessibilityState={{ disabled: !input.trim() || waiting }}
            style={[s.sendBtn, outline(t), (!input.trim() || waiting) && { opacity: 0.4 }]}>
            <TurnIcon turn="straight" color={t.primary.ink} size={24} />
          </SoftPressable>
        </View>
        {input.length >= 200 ? <Text style={[type.meta, { color: t.textMuted, textAlign: 'right', paddingHorizontal: space.xl }]}>{tr('ask.limit', { n: input.length })}</Text> : null}
        </View>
      </KeyboardAvoidingView>
      <SweetSheet visible={sheet === 'privacy'} onClose={() => setSheet(null)} title={tr('ask.howTitle')}>
        <Text style={[type.body, { color: t.text }]}>{tr('design.askScope')}</Text>
      </SweetSheet>
      <SweetSheet visible={sheet === 'reset'} onClose={() => setSheet(null)} title={tr('ask.newChatTitle')}>
        <View style={{ gap: space.lg }}>
          <Text style={[type.body, { color: t.text }]}>{tr('ask.newChatBody')}</Text>
          <Button label={tr('ask.newChat')} onPress={() => { if (pending.current) return; setMessages([]); setInput(''); animatedIds.current.clear(); followBottom.current = true; setAwayFromBottom(false); setSheet(null); }} />
          <Button label={tr('ask.keepChat')} variant="ghost" onPress={() => setSheet(null)} />
        </View>
      </SweetSheet>
      <SweetSheet visible={!!sourceMessage} onClose={() => setSourceMessage(null)} title={tr('ask.sources')}>
        <ScrollView style={{ maxHeight: 420 }} contentContainerStyle={{ gap: space.md }}>
          {sourceMessage?.citations?.map(c => <View key={c.index} style={[s.sourceCard, outline(t)]}>
            <Text style={[type.itemTitle, { color: t.text }]}>[{c.index}] {c.workName}</Text>
            <Text selectable style={[type.body, { color: t.text }]}>{c.sourceTitle}</Text>
            <Text style={[type.meta, { color: t.textMuted }]}>{[c.sourcePublisher, c.sourceYear, c.sourceVolume ? tr('ask.volume', { n: c.sourceVolume }) : null, c.sourcePage ? tr('ask.page', { page: c.sourcePage }) : null].filter(Boolean).join(' · ')}</Text>
            {c.sourceUrl ? <Button compact label={tr('ask.openSource')} variant="secondary" onPress={() => { setSourceError(false); void Linking.openURL(c.sourceUrl!).catch(() => setSourceError(true)); }} /> : null}
          </View>)}
          {sourceError ? <Text accessibilityLiveRegion="polite" style={[type.body, { color: t.danger }]}>{tr('ask.sourceError')}</Text> : null}
        </ScrollView>
      </SweetSheet>
    </SafeAreaView>
  );

  function SeziAnswer({ msg, t }: { msg: Message; t: SweetTheme }) {
    return (
      <View style={[s.answer, outline(t)]} accessibilityLiveRegion="polite">
        <Eyebrow text={tr('ask.sezi')} />
        <Text selectable style={[type.body, { color: t.text }]}>{msg.text}</Text>
        {msg.mode === 'local' ? <View style={{ gap: space.sm }}>
          <Note text={tr('ask.localFallback')} icon={<InfoIcon color={t.textMuted} />} />
          {msg.id === messages[messages.length - 1]?.id && !waiting ? <Button compact variant="secondary" label={tr('ask.retry')} onPress={() => { const lastQuestion = [...messages].reverse().find(m => m.role === 'user'); if (lastQuestion) void ask(lastQuestion.text); }} /> : null}
        </View> : null}
        {msg.citations?.length ? (
          <View style={s.citations}>
            <Button compact label={tr('ask.sourcesCount', { n: msg.citations.length })} variant="secondary" icon={c => <InfoIcon color={c} size={18} />} onPress={() => { setSourceError(false); setSourceMessage(msg); }} />
          </View>
        ) : null}
        {msg.works?.map((w) => {
          const name = loc(w.name, lang);
          return (
            <SoftPressable
              key={w.id}
              onPress={() => router.push({ pathname: '/work/[slug]', params: { slug: w.slug } })}
              accessibilityRole="button"
              accessibilityLabel={`${name}, ${loc(w.type_name, lang)}. ${tr('ask.sources')}: ${w.sources.map((x) => x.title).join(', ')}`}
              accessibilityHint={tr('ask.open', { name })}
              style={s.result}>
              <WorkGlyph slug={w.type_slug} size={40} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[type.itemTitle, { color: t.text }]}>{name}</Text>
                <Text style={[type.meta, { color: t.textMuted }]}>
                  {tr('ask.workDetail')} · {loc(w.type_name, lang)}
                </Text>
              </View>
              <ChevronIcon color={t.textMuted} />
            </SoftPressable>
          );
        })}
      </View>
    );
  }
}

function UserBubble({ text, t, label }: { text: string; t: SweetTheme; label: string }) {
  return (
    <View style={{ alignItems: 'flex-end' }} accessible accessibilityLabel={`${label}: ${text}`}>
      <View style={[bubble.box, { backgroundColor: t.primary.fill }, outline(t)]}>
        <Text style={[type.body, { color: t.primary.ink }]}>{text}</Text>
      </View>
    </View>
  );
}

/** Yalnız yeni ileti FadeInItem ile girer; sanallaştırma eski balonu yeniden monte ederse canlanmaz. */
function MessageReveal({ id, eligible, animatedIds, children }: { id: number; eligible: boolean; animatedIds: Set<number>; children: ReactNode }) {
  const [fresh] = useState(() => eligible && !animatedIds.has(id));
  useEffect(() => {
    animatedIds.add(id);
  }, [animatedIds, id]);
  return fresh ? <FadeInItem index={0}>{children}</FadeInItem> : <View>{children}</View>;
}

function WaitingIndicator({ label }: { label: string }) {
  const reduced = useReducedMotion();
  const t = useSweetTheme();
  return <View accessible accessibilityLabel={label} accessibilityLiveRegion="polite" style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.lg }}>
    <Text style={[type.meta, { color: t.textMuted }]}>{label}</Text>
    {!reduced ? <View style={{ flexDirection: 'row', gap: space.xs }} accessible={false}>{[0, 1, 2].map((index) => <WaitingDot key={index} index={index} />)}</View> : null}
  </View>;
}

function WaitingDot({ index }: { index: number }) {
  const t = useSweetTheme();
  const opacity = useSharedValue(0.3);
  useEffect(() => {
    opacity.set(withDelay(index * stagger.step, withRepeat(withSequence(withTiming(1, { duration: duration.sheetIn, easing: ease.inOut }), withTiming(0.3, { duration: duration.sheetIn, easing: ease.inOut })), -1)));
    return () => cancelAnimation(opacity);
  }, [index, opacity]);
  const style = useAnimatedStyle(() => ({ opacity: opacity.get() }));
  return <Animated.View style={[{ width: 6, height: 6, borderRadius: 3, backgroundColor: t.primaryText }, style]} />;
}

const bubble = StyleSheet.create({
  box: {
    maxWidth: '85%',
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderRadius: radius.lg,
    borderBottomRightRadius: radius.sm,
    borderCurve: 'continuous',
  },
});

const makeStyles = (t: SweetTheme) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.background },
    topBar: { paddingHorizontal: space.xl, paddingBottom: space.sm },
    welcome: { gap: space.md, paddingTop: space.md, paddingBottom: space.lg },
    welcomeMark: { width: 48, height: 48, borderRadius: radius.md, backgroundColor: t.primary.fill, alignItems: 'center', justifyContent: 'center', marginBottom: space.sm },
    suggestion: { flexDirection: 'row', alignItems: 'center', gap: space.md, backgroundColor: t.surface, borderRadius: radius.lg, padding: space.lg, minHeight: 88 },
    privacyLink: { minHeight: 48, paddingHorizontal: space.xl, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm },
    sourceCard: { padding: space.lg, gap: space.sm, backgroundColor: t.soft, borderRadius: radius.md },
    list: { paddingHorizontal: space.xl, paddingBottom: space.lg, gap: space.lg },
    suggestions: { gap: space.md, paddingTop: space.sm },
    answer: {
      gap: space.sm,
      padding: space.lg,
      borderRadius: radius.lg,
      borderBottomLeftRadius: radius.sm,
      borderCurve: 'continuous',
      backgroundColor: t.surface,
    },
    result: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.md,
      paddingTop: space.md,
      minHeight: 64,
      borderTopWidth: t.outlined ? 1 : StyleSheet.hairlineWidth,
      borderTopColor: t.border,
    },
    citations: { gap: space.xs, paddingTop: space.xs },
    composer: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: space.sm,
      paddingHorizontal: space.lg,
      paddingVertical: space.sm,
      borderTopWidth: t.outlined ? 1 : StyleSheet.hairlineWidth,
      borderTopColor: t.border,
      backgroundColor: t.background,
    },
    input: {
      flex: 1,
      minHeight: 54,
      maxHeight: 140,
      paddingVertical: space.md,
      paddingHorizontal: space.lg,
      borderRadius: radius.md,
      borderCurve: 'continuous',
      borderWidth: t.outlined ? 2 : 1,
      borderColor: t.outlined ? t.border : t.soft,
      backgroundColor: t.soft,
      color: t.text,
    },
    sendBtn: {
      width: 54,
      height: 54,
      borderRadius: radius.md,
      borderCurve: 'continuous',
      backgroundColor: t.primary.fill,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });

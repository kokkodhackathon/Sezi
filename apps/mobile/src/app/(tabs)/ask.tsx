import type { SweetTheme } from '@sezi/shared';
import { router } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTabBarSpace } from '@/components/app-tabs';
import { ScreenHeader } from '@/components/screen-header';
import { Chip, Eyebrow, Note } from '@/components/ui';
import { ChevronIcon, InfoIcon, TurnIcon } from '@/design/icons';
import { outline, SoftPressable } from '@/design/sweet/components';
import { radius, space, type } from '@/design/type';
import { WorkGlyph } from '@/design/work-glyph';
import { useReducedMotion } from '@/hooks/use-reduced-motion';
import { useSweetTheme } from '@/hooks/use-sweet-theme';
import { searchWorks } from '@/lib/ask';
import { useT } from '@/lib/i18n';
import { loc, useWorks, type WorkRow } from '@/lib/works';

type Message = { id: number; role: 'user' | 'sezi'; text: string; works?: WorkRow[] };

export default function Ask() {
  const reducedMotion = useReducedMotion();
  const t = useSweetTheme();
  const s = useMemo(() => makeStyles(t), [t]);
  const { t: tr, lang } = useT();
  const { data: works } = useWorks();
  const tabSpace = useTabBarSpace();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const listRef = useRef<FlatList<Message>>(null);
  const nextId = useRef(1);

  const ask = (question: string) => {
    const q = question.trim();
    if (!q) return;
    const found = searchWorks(q, works ?? []).slice(0, 10);
    const answer: Message = {
      id: nextId.current++,
      role: 'sezi',
      text: found.length ? tr('ask.found', { n: found.length }) : tr('ask.notFound'),
      works: found,
    };
    setMessages((m) => [...m, { id: nextId.current++, role: 'user', text: q }, answer]);
    setInput('');
    setTimeout(() => listRef.current?.scrollToEnd({ animated: !reducedMotion }), 50);
  };

  const suggestions = [tr('ask.suggest1'), tr('ask.suggest2'), tr('ask.suggest3')];

  const header = (
    <View style={{ gap: space.lg, paddingBottom: space.md }}>
      <ScreenHeader title={tr('ask.title')} />
      <Text style={[type.body, { color: t.text }]}>{tr('design.askIntro')}</Text>
      <View style={s.suggestions}>
        {suggestions.map((q) => (
          <Chip key={q} label={q} selected={false} onPress={() => ask(q)} />
        ))}
      </View>
      <Note text={tr('design.askScope')} icon={<InfoIcon color={t.textMuted} />} />
    </View>
  );

  return (
    <SafeAreaView style={s.screen} edges={['top']}>
      {/* Android uçtan uca çizimde pencere klavyeyle küçülmüyor; yazı alanını klavyenin üstünde tutmak için iki platformda da padding. */}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <FlatList
          ref={listRef}
          keyboardShouldPersistTaps="handled"
          data={messages}
          keyExtractor={(m) => String(m.id)}
          ListHeaderComponent={header}
          contentContainerStyle={s.list}
          renderItem={({ item }) => (item.role === 'user' ? <UserBubble text={item.text} t={t} label={tr('ask.you')} /> : <SeziAnswer msg={item} t={t} />)}
        />
        {/* Yazı alanı yüzen sekme çubuğunun üstünde durur; klavye açıkken çubuk gizli, boşluk küçülür. */}
        <View style={[s.composer, { marginBottom: tabSpace - space.lg }]}>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder={tr('ask.placeholder')}
            placeholderTextColor={t.textMuted}
            accessibilityLabel={tr('ask.placeholder')}
            returnKeyType="send"
            onSubmitEditing={() => ask(input)}
            style={[type.body, s.input]}
            maxLength={200}
          />
          <SoftPressable
            onPress={() => ask(input)}
            disabled={!input.trim()}
            accessibilityRole="button"
            accessibilityLabel={tr('ask.send')}
            accessibilityState={{ disabled: !input.trim() }}
            style={[s.sendBtn, outline(t), !input.trim() && { opacity: 0.4 }]}>
            <TurnIcon turn="straight" color={t.primary.ink} size={24} />
          </SoftPressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );

  function SeziAnswer({ msg, t }: { msg: Message; t: SweetTheme }) {
    return (
      <View style={[s.answer, outline(t)]} accessibilityLiveRegion="polite">
        <Eyebrow text={tr('ask.sezi')} />
        <Text style={[type.body, { color: t.text }]}>{msg.text}</Text>
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
                  {loc(w.type_name, lang)} · {tr('ask.sources')}: {w.sources.map((x) => x.publisher ?? x.title).join(', ')}
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
    list: { paddingHorizontal: space.xl, paddingBottom: space.lg, gap: space.lg },
    suggestions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
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
    composer: {
      flexDirection: 'row',
      alignItems: 'center',
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

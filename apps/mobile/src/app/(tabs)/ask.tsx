import type { ThemeColors } from '@sezi/shared';
import { router } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/screen-header';
import { Chip, Eyebrow, Note } from '@/components/ui';
import { ChevronIcon, InfoIcon, TurnIcon } from '@/design/icons';
import { radius, space, type } from '@/design/type';
import { WorkGlyph } from '@/design/work-glyph';
import { useSeziTheme } from '@/hooks/use-sezi-theme';
import { searchWorks } from '@/lib/ask';
import { useT } from '@/lib/i18n';
import { loc, useWorks, type WorkRow } from '@/lib/works';

type Message = { id: number; role: 'user' | 'sezi'; text: string; works?: WorkRow[] };

export default function Ask() {
  const t = useSeziTheme();
  const s = useMemo(() => makeStyles(t), [t]);
  const { t: tr, lang } = useT();
  const { data: works } = useWorks();
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
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
  };

  const suggestions = [tr('ask.suggest1'), tr('ask.suggest2'), tr('ask.suggest3')];

  const header = (
    <View style={{ gap: space.lg, paddingBottom: space.md }}>
      <ScreenHeader eyebrow={tr('ask.eyebrow')} title={tr('ask.title')} />
      <Text style={[type.body, { color: t.text }]}>{tr('ask.intro')}</Text>
      <View style={s.suggestions}>
        {suggestions.map((q) => (
          <Chip key={q} label={q} selected={false} onPress={() => ask(q)} />
        ))}
      </View>
      <Note text={tr('ask.mode')} icon={<InfoIcon color={t.textMuted} />} />
    </View>
  );

  return (
    <SafeAreaView style={s.screen} edges={['top']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => String(m.id)}
          ListHeaderComponent={header}
          contentContainerStyle={s.list}
          renderItem={({ item }) => (item.role === 'user' ? <UserBubble text={item.text} t={t} label={tr('ask.you')} /> : <SeziAnswer msg={item} t={t} />)}
        />
        <View style={s.composer}>
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
          <Pressable
            onPress={() => ask(input)}
            disabled={!input.trim()}
            accessibilityRole="button"
            accessibilityLabel={tr('ask.send')}
            accessibilityState={{ disabled: !input.trim() }}
            style={({ pressed }) => [s.sendBtn, !input.trim() && { opacity: 0.4 }, pressed && { opacity: 0.85 }]}>
            <TurnIcon turn="straight" color={t.onPrimary} size={24} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );

  function SeziAnswer({ msg, t }: { msg: Message; t: ThemeColors }) {
    return (
      <View style={s.answer} accessibilityLiveRegion="polite">
        <Eyebrow text={tr('ask.sezi')} />
        <Text style={[type.body, { color: t.text }]}>{msg.text}</Text>
        {msg.works?.map((w) => {
          const name = loc(w.name, lang);
          return (
            <Pressable
              key={w.id}
              onPress={() => router.push({ pathname: '/work/[slug]', params: { slug: w.slug } })}
              accessibilityRole="button"
              accessibilityLabel={`${name}, ${loc(w.type_name, lang)}. ${tr('ask.sources')}: ${w.sources.map((x) => x.title).join(', ')}`}
              accessibilityHint={tr('ask.open', { name })}
              style={({ pressed }) => [s.result, pressed && { backgroundColor: t.background }]}>
              <WorkGlyph slug={w.type_slug} size={40} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[type.itemTitle, { color: t.text, fontSize: 16 }]}>{name}</Text>
                <Text style={[type.meta, { color: t.textMuted }]} numberOfLines={1}>
                  {loc(w.type_name, lang)} · {tr('ask.sources')}: {w.sources.map((x) => x.publisher ?? x.title).join(', ')}
                </Text>
              </View>
              <ChevronIcon color={t.textMuted} />
            </Pressable>
          );
        })}
      </View>
    );
  }
}

function UserBubble({ text, t, label }: { text: string; t: ThemeColors; label: string }) {
  return (
    <View style={{ alignItems: 'flex-end' }} accessible accessibilityLabel={`${label}: ${text}`}>
      <View style={[bubble.box, { backgroundColor: t.primary }]}>
        <Text style={[type.body, { color: t.onPrimary }]}>{text}</Text>
      </View>
    </View>
  );
}

const bubble = StyleSheet.create({
  box: { maxWidth: '85%', paddingHorizontal: space.lg, paddingVertical: space.md, borderRadius: radius.lg, borderBottomRightRadius: 6 },
});

const makeStyles = (t: ThemeColors) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.background },
    list: { paddingHorizontal: space.lg, paddingBottom: space.lg, gap: space.lg },
    suggestions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
    answer: { gap: space.sm, padding: space.lg, borderRadius: radius.lg, borderBottomLeftRadius: 6, borderWidth: 1, borderColor: t.border, backgroundColor: t.surface },
    result: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.sm, borderRadius: radius.md, borderWidth: 1, borderColor: t.border },
    composer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.sm,
      paddingHorizontal: space.lg,
      paddingVertical: space.sm,
      borderTopWidth: 1,
      borderTopColor: t.border,
      backgroundColor: t.background,
    },
    input: { flex: 1, minHeight: 52, paddingHorizontal: space.lg, borderRadius: radius.pill, borderWidth: 1.5, borderColor: t.border, backgroundColor: t.surface, color: t.text },
    sendBtn: { width: 52, height: 52, borderRadius: 26, backgroundColor: t.primary, alignItems: 'center', justifyContent: 'center' },
  });

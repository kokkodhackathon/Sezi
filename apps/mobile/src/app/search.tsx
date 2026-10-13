import type { ThemeColors } from '@sezi/shared';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Chip, EmptyState, Eyebrow } from '@/components/ui';
import { ChevronIcon } from '@/design/icons';
import { radius, space, type } from '@/design/type';
import { WorkGlyph } from '@/design/work-glyph';
import { useSeziTheme } from '@/hooks/use-sezi-theme';
import { normalize } from '@/lib/ask';
import { useT } from '@/lib/i18n';
import { loc, useWorks } from '@/lib/works';

export default function Search() {
  const t = useSeziTheme();
  const s = useMemo(() => makeStyles(t), [t]);
  const { t: tr, lang } = useT();
  const { data: works } = useWorks();
  const [q, setQ] = useState('');

  const results = useMemo(() => {
    const n = normalize(q).trim();
    if (!n) return [];
    return (works ?? []).filter((w) =>
      normalize([w.name.tr, w.name.en, w.type_name.tr, w.type_name.en, w.complex_name?.tr, w.district, w.city_name.tr].filter(Boolean).join(' ')).includes(n),
    );
  }, [q, works]);

  const suggestions = useMemo(() => [...new Set((works ?? []).map((w) => loc(w.type_name, lang)))].slice(0, 6), [works, lang]);

  return (
    <View style={s.screen}>
      <View style={s.searchBar}>
        <TextInput
          value={q}
          onChangeText={setQ}
          autoFocus
          placeholder={tr('search.placeholder')}
          placeholderTextColor={t.textMuted}
          accessibilityLabel={tr('search.title')}
          returnKeyType="search"
          style={[type.lead, s.input]}
        />
      </View>
      <FlatList
        data={results}
        keyExtractor={(w) => w.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={s.list}
        ListHeaderComponent={
          q.trim() ? (
            <Text style={[type.meta, { color: t.textMuted }]} accessibilityLiveRegion="polite">
              {tr('search.results', { n: results.length })}
            </Text>
          ) : (
            <View style={{ gap: space.md }}>
              <Eyebrow text={tr('search.recent')} />
              <View style={s.chips}>
                {suggestions.map((x) => (
                  <Chip key={x} label={x} selected={false} onPress={() => setQ(x)} />
                ))}
              </View>
            </View>
          )
        }
        ListEmptyComponent={q.trim() ? <EmptyState title={tr('search.empty')} /> : null}
        renderItem={({ item }) => {
          const name = loc(item.name, lang);
          const kind = loc(item.type_name, lang);
          return (
            <Pressable
              onPress={() => router.push({ pathname: '/work/[slug]', params: { slug: item.slug } })}
              accessibilityRole="button"
              accessibilityLabel={`${name}, ${kind}`}
              style={({ pressed }) => [s.row, pressed && { backgroundColor: t.background }]}>
              <WorkGlyph slug={item.type_slug} size={44} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[type.itemTitle, { color: t.text }]}>{name}</Text>
                <Text style={[type.meta, { color: t.textMuted }]}>{kind}</Text>
              </View>
              <ChevronIcon color={t.textMuted} />
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const makeStyles = (t: ThemeColors) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.background },
    searchBar: { paddingHorizontal: space.lg, paddingTop: space.md, paddingBottom: space.md },
    input: { minHeight: 56, paddingHorizontal: space.lg, borderRadius: radius.pill, borderWidth: 2, borderColor: t.primary, backgroundColor: t.surface, color: t.text },
    list: { paddingHorizontal: space.lg, paddingBottom: space.xxl, gap: space.sm },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
    row: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderRadius: radius.lg, borderWidth: 1, borderColor: t.border, backgroundColor: t.surface },
  });

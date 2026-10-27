import { loc, type Achievement, type LocalizedText, type UserPhoto, type Visit } from '@sezi/shared';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AchievementDetail, AchievementTile, achievementTitle, photoStatus, Stamp, StatusDots, useGridColumns } from '@/components/social-visuals';
import { CameraIcon } from '@/design/icons';
import { outline, SoftPressable, SweetSheet } from '@/design/sweet/components';
import { radius, space, type } from '@/design/type';
import { useSweetTheme } from '@/hooks/use-sweet-theme';
import { useT } from '@/lib/i18n';

/** Eşit sütunlu ızgara: son satır boş hücrelerle doldurulur, hücreler eşit genişlikte kalır. */
export function Grid<T>({ items, columns, render, keyOf }: { items: T[]; columns: number; render: (item: T) => ReactNode; keyOf: (item: T) => string }) {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += columns) rows.push(items.slice(i, i + columns));
  return (
    <View style={{ gap: space.lg }}>
      {rows.map((row) => (
        <View key={row.map(keyOf).join('|')} style={s.row}>
          {row.map((item) => (
            <View key={keyOf(item)} style={s.cell}>
              {render(item)}
            </View>
          ))}
          {Array.from({ length: columns - row.length }, (_, i) => (
            <View key={`pad${i}`} style={s.cell} />
          ))}
        </View>
      ))}
    </View>
  );
}

type StampWork = { slug: string; name: LocalizedText; type_slug: string };

/** Az önce basılan damga (son iki dakika) bir kez "basılır". */
const isFresh = (visit: Visit) => Date.now() - new Date(visit.first_at).getTime() < 120_000;

/** Damga ızgarası: tür glifli eğik damgalar, altında tek satır ad; dokununca eser sayfası. */
export function StampGrid({ visits, works, limit }: { visits: Visit[]; works: Map<string, StampWork>; limit?: number }) {
  const t = useSweetTheme();
  const { t: tr, lang } = useT();
  const columns = useGridColumns(96, 3);
  const items = [...visits]
    .filter((visit) => works.has(visit.work_slug))
    .sort((a, b) => b.first_at.localeCompare(a.first_at))
    .slice(0, limit);
  return (
    <Grid
      items={items}
      columns={columns}
      keyOf={(visit) => visit.work_slug}
      render={(visit) => {
        const work = works.get(visit.work_slug)!;
        const name = loc(work.name, lang);
        const date = new Date(visit.first_at).toLocaleDateString(lang, { dateStyle: 'long' });
        const method = tr(visit.method === 'checkin' ? 'passport.byCheckin' : 'passport.byRoute');
        return (
          <SoftPressable
            onPress={() => router.push({ pathname: '/work/[slug]', params: { slug: visit.work_slug } })}
            accessibilityRole="button"
            accessibilityLabel={`${name}, ${date}, ${method}`}
            style={s.stampCell}>
            <Stamp slug={visit.work_slug} typeSlug={work.type_slug} fresh={isFresh(visit)} />
            <Text style={[type.bubble, { color: t.text, textAlign: 'center' }]} numberOfLines={1}>
              {name}
            </Text>
          </SoftPressable>
        );
      }}
    />
  );
}

/** Başarım ızgarası + dokununca alt panelde ayrıntı. */
export function AchievementGrid({ list }: { list: Achievement[] }) {
  const { t: tr, lang } = useT();
  const columns = useGridColumns(96, 3);
  const [open, setOpen] = useState<Achievement | null>(null);
  return (
    <>
      <Grid items={list} columns={columns} keyOf={(a) => a.id} render={(a) => <AchievementTile achievement={a} onPress={() => setOpen(a)} />} />
      <SweetSheet visible={!!open} onClose={() => setOpen(null)} title={open ? achievementTitle(open, tr, lang) : ''}>
        {open ? <AchievementDetail achievement={open} /> : null}
      </SweetSheet>
    </>
  );
}

/** Kazanılanlar önce (en yeni önce), sonra kilitliler en yakından uzağa. */
export function sortAchievements(list: Achievement[]) {
  const earned = list.filter((a) => a.level > 0).sort((a, b) => (b.earnedAt ?? '').localeCompare(a.earnedAt ?? ''));
  const locked = list
    .filter((a) => a.level === 0)
    .sort((a, b) => b.current / (b.nextTarget || 1) - a.current / (a.nextTarget || 1));
  return { earned, locked };
}

/**
 * Fotoğraf ızgarası: kare küçük resim, köşede durum simgeleri. `onAdd` verilirse ilk hücre kesikli "ekle" kutusu.
 * Etiket: alt metin + durumlar ("Ulucami avlusu. Herkes, İncelemede").
 */
export function PhotoGrid({
  photos,
  urls,
  onOpen,
  onAdd,
  showStatus = true,
}: {
  photos: UserPhoto[];
  urls: Record<string, string> | undefined;
  onOpen?: (photo: UserPhoto) => void;
  onAdd?: () => void;
  /** Durum simgeleri yalnız sahibine anlamlı (başkasının fotoğrafında gösterilmez). */
  showStatus?: boolean;
}) {
  const t = useSweetTheme();
  const { t: tr } = useT();
  const columns = useGridColumns(96, 3);
  type Cell = { kind: 'add' } | { kind: 'photo'; photo: UserPhoto };
  const cells: Cell[] = [...(onAdd ? [{ kind: 'add' } as const] : []), ...photos.map((photo) => ({ kind: 'photo', photo }) as const)];
  return (
    <Grid
      items={cells}
      columns={columns}
      keyOf={(cell) => (cell.kind === 'add' ? 'add' : cell.photo.id)}
      render={(cell) => {
        if (cell.kind === 'add') {
          return (
            <SoftPressable
              onPress={onAdd}
              accessibilityRole="button"
              accessibilityLabel={tr('photos.add')}
              style={[s.photo, s.add, { borderColor: t.primaryText }]}>
              <CameraIcon color={t.primaryText} size={28} />
              <Text style={[type.bubble, { color: t.primaryText }]}>{tr('photos.addShort')}</Text>
            </SoftPressable>
          );
        }
        const { photo } = cell;
        const status = photoStatus(photo, tr);
        const label = showStatus ? `${photo.alt_text}. ${status.map((item) => item.label).join(', ')}` : photo.alt_text;
        const body = (
          <>
            <Image
              source={urls?.[photo.thumb_path]}
              style={[StyleSheet.absoluteFill, { backgroundColor: t.soft }]}
              contentFit="cover"
              accessible={false}
            />
            {showStatus ? <StatusDots items={status} /> : null}
          </>
        );
        return onOpen ? (
          <SoftPressable
            onPress={() => onOpen(photo)}
            accessibilityRole="button"
            accessibilityLabel={label}
            style={[s.photo, outline(t)]}>
            {body}
          </SoftPressable>
        ) : (
          <View accessible accessibilityRole="image" accessibilityLabel={photo.alt_text} style={[s.photo, outline(t)]}>
            <Image source={urls?.[photo.thumb_path]} style={[StyleSheet.absoluteFill, { backgroundColor: t.soft }]} contentFit="cover" accessible={false} />
          </View>
        );
      }}
    />
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', gap: space.md },
  cell: { flex: 1, minWidth: 0 },
  stampCell: { alignItems: 'center', gap: space.sm, minHeight: 48, paddingVertical: space.xs },
  photo: { aspectRatio: 1, borderRadius: radius.md, borderCurve: 'continuous', overflow: 'hidden' },
  add: { borderWidth: 2, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', gap: space.xs },
});

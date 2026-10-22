import type { WorkPhoto } from '@sezi/shared';
import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';

import { PhotoSourceThumbTag } from '@/components/photo-source';
import { CheckIcon, ChevronIcon, MapIcon, PinIcon, RouteIcon, TurnIcon } from '@/design/icons';
import { outline, SoftPressable } from '@/design/sweet/components';
import { radius, space, type } from '@/design/type';
import { useSweetTheme } from '@/hooks/use-sweet-theme';
import { useT } from '@/lib/i18n';
import { photoUrl } from '@/lib/works';

export type LynchStopKind = 'stop' | 'landmark' | 'node' | 'district' | 'start' | 'arrival';
export interface LynchStop {
  key: string;
  kind: LynchStopKind;
  title: string;
  subtitle?: string;
  index?: number;
  photo?: WorkPhoto | null;
  done?: boolean;
  onPress?: () => void;
}

/** Durağın sırası ve yerin türü, renk olmadan da okunur. */
export function LynchLine({ stops, compact = false }: { stops: LynchStop[]; compact?: boolean }) {
  const t = useSweetTheme();
  const { t: tr } = useT();
  return (
    <View>
      {stops.map((stop, position) => {
        const minor = stop.kind === 'landmark' || stop.kind === 'node';
        const label = tr(`lynch.${stop.kind}`);
        const ink = stop.done ? t.primary.ink : t.primaryText;
        const badge = stop.done ? <CheckIcon color={ink} size={18} />
          : stop.kind === 'stop' ? <Text style={[type.bubble, { color: ink }]}>{stop.index ?? position + 1}</Text>
          : stop.kind === 'landmark' ? <PinIcon color={ink} size={18} />
          : stop.kind === 'district' ? <MapIcon color={ink} size={18} />
          : stop.kind === 'arrival' ? <TurnIcon turn="straight" arrived color={ink} size={20} />
          : <RouteIcon color={ink} size={18} />;
        const content = (
          <>
            {!compact && stop.photo ? <View style={s.photo}><Image source={{ uri: photoUrl(stop.photo, 'thumb') }} style={StyleSheet.absoluteFill} contentFit="cover" accessible={false} /><PhotoSourceThumbTag photo={stop.photo} /></View> : null}
            <View style={s.copy}>
              <Text style={[type.meta, { color: t.textMuted }]}>{label}{stop.kind === 'stop' && stop.index ? ` ${stop.index}` : ''}</Text>
              <Text style={[minor || compact ? type.cardTitle : type.itemTitle, { color: t.text }]} accessibilityRole={stop.kind === 'district' ? 'header' : undefined}>{stop.title}</Text>
              {stop.subtitle ? <Text style={[type.meta, { color: t.textMuted }]}>{stop.subtitle}</Text> : null}
              {stop.done ? <Text style={[type.meta, { color: t.primaryText }]}>{tr('work.visited')}</Text> : null}
            </View>
            {stop.onPress ? <ChevronIcon color={t.textMuted} size={18} /> : null}
          </>
        );
        const cardStyle = [s.card, { backgroundColor: minor || stop.kind === 'district' ? t.background : t.surface, padding: compact || minor ? space.sm : space.md }, !minor && outline(t)];
        const accessibilityLabel = [label, stop.index, stop.title, stop.subtitle, stop.done ? tr('work.visited') : null].filter(Boolean).join('. ');
        return (
          <View key={stop.key} style={s.row}>
            <View style={s.rail} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
              <View style={[s.badge, minor && s.minorBadge, { backgroundColor: stop.done ? t.primary.fill : t.background, borderColor: t.primaryText }]}>{badge}</View>
              {position < stops.length - 1 ? <View style={[s.line, { backgroundColor: t.border }]} /> : null}
            </View>
            {stop.onPress ? <SoftPressable onPress={stop.onPress} accessibilityRole="button" accessibilityLabel={accessibilityLabel} style={cardStyle}>{content}</SoftPressable>
              : <View accessible accessibilityLabel={accessibilityLabel} style={cardStyle}>{content}</View>}
          </View>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', gap: space.md },
  rail: { width: 36, alignItems: 'center', paddingTop: space.sm },
  badge: { width: 36, height: 36, borderRadius: 18, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  minorBadge: { width: 28, height: 28, borderRadius: 14, marginVertical: 4 },
  line: { width: 2, flex: 1, minHeight: space.md, marginVertical: space.xs },
  card: { flex: 1, minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: space.md, borderRadius: radius.md, borderCurve: 'continuous', marginBottom: space.md },
  copy: { flex: 1, gap: space.xs },
  photo: { width: 56, height: 72, borderRadius: radius.sm, borderCurve: 'continuous', overflow: 'hidden' },
});

import { loc, THRESHOLDS, type Achievement } from '@sezi/shared';
import { Text, View } from 'react-native';
import { Card, ProgressBar } from '@/components/ui';
import {
  CameraIcon,
  CheckIcon,
  CompassIcon,
  InfoIcon,
  ListIcon,
  LockIcon,
  MapIcon,
  PersonIcon,
  RouteIcon,
} from '@/design/icons';
import { IconBubble } from '@/design/sweet/components';
import { space, type } from '@/design/type';
import { useSweetTheme } from '@/hooks/use-sweet-theme';
import { useT } from '@/lib/i18n';

const icons = {
  first_stamp: CheckIcon,
  stamps: CheckIcon,
  complex: CheckIcon,
  types: ListIcon,
  cities: MapIcon,
  walker: RouteIcon,
  tour: CompassIcon,
  reporter: InfoIcon,
  photographer: CameraIcon,
  sharer: CameraIcon,
  companion: PersonIcon,
};

export function AchievementBadge({ achievement: a }: { achievement: Achievement }) {
  const t = useSweetTheme();
  const { t: tr, lang } = useT();
  const title = tr(`ach.${a.kind}.title`, { name: a.subject ? loc(a.subject.name, lang) : '' });
  const thresholds = a.kind === 'complex' || a.kind === 'tour' ? null : THRESHOLDS[a.kind];
  const target = a.nextTarget ?? thresholds?.[thresholds.length - 1] ?? a.current;
  const earned = a.level > 0;
  const date = a.earnedAt ? new Date(a.earnedAt).toLocaleDateString(lang) : null;
  const status = earned ? `${tr('ach.earnedStatus')}${date ? `, ${date}` : ''}` : tr('ach.locked');
  const Icon = earned ? icons[a.kind] : LockIcon;
  return (
    <Card style={{ gap: space.md }}>
      <View
        accessible
        accessibilityLabel={`${title}. ${status}. ${a.current} / ${target}`}
        style={{ flexDirection: 'row', gap: space.md, alignItems: 'center' }}>
        <IconBubble icon={(color) => <Icon color={color} />} label={title} />
        <View style={{ flex: 1, gap: space.xs }}>
          <Text style={[type.itemTitle, { color: t.text }]}>{title}</Text>
          <Text style={[type.meta, { color: t.textMuted }]}>{status}</Text>
          <Text style={[type.meta, { color: t.textMuted }]}>
            {tr('ach.level', { level: a.level, max: a.maxLevel })}
          </Text>
        </View>
      </View>
      <Text style={[type.body, { color: t.text }]}>
        {tr(`ach.${a.kind}.body`, { n: target, name: a.subject ? loc(a.subject.name, lang) : '' })}
      </Text>
      {!earned && a.nextTarget !== null ? (
        <ProgressBar value={a.current} max={a.nextTarget} label={title} />
      ) : null}
    </Card>
  );
}

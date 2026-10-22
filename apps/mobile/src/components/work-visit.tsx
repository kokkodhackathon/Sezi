import { loc, type PlannedRoute, type SweetTheme, type UserProfile, type WorkRow } from '@sezi/shared';
import { router } from 'expo-router';
import { Text, View } from 'react-native';

import { Card, ListRow } from '@/components/ui';
import { space, type } from '@/design/type';
import { useT } from '@/lib/i18n';
import { walkingSpeed } from '@/lib/nav';

type Row = { key: string; title: string; subtitle?: string };

/**
 * Gitmeden önce: giriş (basamak, rampa), açık saatler, gezme süresi ve pilot alanda başlangıçtan yürüme süresi.
 * Hareket kısıtı olan profilde giriş ve yol satırları öne çıkar. Ziyaret bilgisi yalnız kaynağı ve kontrol tarihiyle
 * gelir (veritabanı kuralı); yoksa bunu açıkça söyler, tahmin yazmaz.
 */
export function WorkVisit({ work, route, profile, t }: { work: WorkRow; route: PlannedRoute | null; profile: UserProfile | null; t: SweetTheme }) {
  const { t: tr, lang } = useT();
  const entrance = [
    work.visit_steps === null ? null : work.visit_steps === 0 ? tr('work.visitStepFree') : tr('work.visitSteps', { n: work.visit_steps }),
    work.visit_ramp === null ? null : work.visit_ramp ? tr('work.visitRamp') : tr('work.visitNoRamp'),
  ].filter((x): x is string => !!x);

  const access: Row[] = [];
  if (entrance.length) access.push({ key: 'entrance', title: tr('work.entrance'), subtitle: entrance.join(' · ') });
  if (route && profile) {
    const minutes = Math.max(1, Math.round(route.route.lengthM / walkingSpeed(profile) / 60));
    access.push({
      key: 'walk',
      title: tr('work.visitWalk', { min: minutes, m: Math.round(route.route.lengthM) }),
      subtitle: route.stairSegments === 0 ? tr('work.accessStepFree') : tr('work.accessStairs', { n: route.stairSegments }),
    });
  }
  const plan: Row[] = [];
  const hours = loc(work.visit_hours, lang);
  if (hours) plan.push({ key: 'hours', title: tr('work.visitHours'), subtitle: hours });
  if (work.visit_minutes) plan.push({ key: 'minutes', title: tr('work.visitMinutes', { n: work.visit_minutes }) });
  const note = loc(work.visit_note, lang);
  if (note) plan.push({ key: 'note', title: note });

  const moving = profile !== null && profile.mobility !== 'none';
  const rows = moving ? [...access, ...plan] : [...plan, ...access];
  const checked = work.visit_checked_on ? new Date(`${work.visit_checked_on}T12:00:00`).toLocaleDateString(lang === 'tr' ? 'tr-TR' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : null;
  const sourced = work.visit_source && checked;

  return (
    <View style={{ gap: space.md }}>
      <Card padded={false}>
        {rows.map((r, i) => (
          <ListRow key={r.key} first={i === 0} title={r.title} subtitle={r.subtitle} />
        ))}
        <ListRow first={rows.length === 0} title={tr('work.report')} hint={tr('work.reportHint')} onPress={() => router.push({ pathname: '/report/new', params: { work: work.slug } })} />
      </Card>
      <Text style={[type.meta, { color: t.textMuted }]}>
        {sourced ? tr('work.visitSource', { source: work.visit_source!, date: checked }) : tr('work.visitPending')}
      </Text>
    </View>
  );
}

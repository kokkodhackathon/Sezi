import {
  achievements,
  ContributionsSchema,
  EMPTY_CONTRIBUTIONS,
  hasLocation,
  passportStats,
  type PassportWork,
} from '@sezi/shared';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';
import { AppState } from 'react-native';
import { useAccount } from './account';
import { usePassport } from './passport';
import { useReports } from './reports';
import { supabase } from './supabase';
import { useTours } from './tours';
import { useWorks } from './works';

export function useAchievements() {
  const { user } = useAccount();
  const { visits } = usePassport();
  const worksQuery = useWorks();
  const tours = useTours();
  const reports = useReports();
  const contributionsQuery = useQuery({
    queryKey: ['contributions', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contributions')
        .select('reports_approved, photos_public, photos_archived, friends')
        .eq('user_id', user!.id)
        .maybeSingle();
      if (error) throw error;
      return data ? ContributionsSchema.parse(data) : EMPTY_CONTRIBUTIONS;
    },
  });
  const { refetch } = contributionsQuery;
  useEffect(() => {
    if (!user) return;
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refetch();
    });
    return () => sub.remove();
  }, [user, refetch]);
  const works = useMemo<PassportWork[]>(
    () =>
      (worksQuery.data ?? []).map((work) => ({
        slug: work.slug,
        name: work.name,
        type_slug: work.type_slug,
        city_slug: work.city_slug,
        complex_slug: work.complex_slug,
        complex_name: work.complex_name,
        located: hasLocation(work),
      })),
    [worksQuery.data],
  );
  const approved = reports.filter((report) => report.status === 'approved').length;
  const contributions = useMemo(
    () =>
      user
        ? (contributionsQuery.data ?? EMPTY_CONTRIBUTIONS)
        : { ...EMPTY_CONTRIBUTIONS, reports_approved: approved },
    [user, contributionsQuery.data, approved],
  );
  return useMemo(
    () => ({
      list: achievements({ visits, works, tours, contributions }),
      stats: passportStats(visits, works, tours),
      // İlk bildirim tabanı, eksik sunucu verisiyle oluşturulmaz.
      ready: worksQuery.isSuccess && (!user || contributionsQuery.isSuccess),
    }),
    [visits, works, tours, contributions, worksQuery.isSuccess, user, contributionsQuery.isSuccess],
  );
}

import { ContributionsSchema, ProfileCardSchema, Username, VisitSchema } from '@sezi/shared';
import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';

import { useAccount } from './account';
import { privateObject, supabase } from './supabase';

const COLUMNS = 'user_id,display_name,username,avatar_path,avatar_tone,visibility,findable';

export function usePerson(uid: string) {
  const { user, session } = useAccount();
  const query = useQuery({
    queryKey: ['person', uid, user?.id],
    enabled: !!uid && !!user,
    queryFn: async () => {
      const profile = await supabase.from('profiles').select(COLUMNS).eq('user_id', uid).maybeSingle();
      if (profile.error) throw profile.error;
      if (!profile.data) return null;
      const contributions = await supabase
        .from('contributions')
        .select('reports_approved,photos_public,photos_archived,friends')
        .eq('user_id', uid)
        .maybeSingle();
      if (contributions.error) throw contributions.error;
      return {
        profile: ProfileCardSchema.parse(profile.data),
        contributions: contributions.data ? ContributionsSchema.parse(contributions.data) : null,
      };
    },
  });
  const path = query.data?.profile.avatar_path;
  const avatar = path && session ? privateObject('avatars', path, session.access_token) : null;
  return { ...query, avatar };
}

export function usePersonVisits(uid: string, enabled = true) {
  const { user } = useAccount();
  return useQuery({
    queryKey: ['person-visits', uid, user?.id],
    enabled: !!uid && !!user && enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('visits')
        .select('work_slug,first_at,method,distance_m')
        .eq('user_id', uid)
        .order('first_at', { ascending: false });
      if (error) throw error;
      return z.array(VisitSchema).parse(data);
    },
  });
}

export async function searchPeople(q: string) {
  const parsed = Username.safeParse(q);
  if (!parsed.success) return [];
  const { data, error } = await supabase
    .from('profiles')
    .select(COLUMNS)
    .ilike('username', `${parsed.data.replace(/_/g, '\\_')}%`)
    .limit(10);
  if (error) throw error;
  return z.array(ProfileCardSchema).parse(data);
}

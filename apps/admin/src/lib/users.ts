import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';

import { supabase } from './supabase';

const VisitSchema = z.object({ user_id: z.string().uuid(), work_slug: z.string(), method: z.string(), first_at: z.string() });
const UserSchema = z.object({
  id: z.string().uuid(), email: z.string().nullable(), created_at: z.string(), last_sign_in_at: z.string().nullable(),
  banned: z.boolean(), is_admin: z.boolean(), provider: z.string().nullable(),
  profile: z.object({ display_name: z.string(), username: z.string().nullable(), avatar_url: z.string().nullable() }).nullable(),
  counts: z.object({ visits: z.number(), photos: z.object({ total: z.number(), pending: z.number() }), reports: z.object({ pending: z.number(), approved: z.number() }) }),
  contributions: z.object({ reports_approved: z.number(), photos_public: z.number(), photos_archived: z.number(), friends: z.number() }).nullable(),
  recent_visits: z.array(VisitSchema),
});
const ListSchema = z.object({ users: z.array(UserSchema) });
const OkSchema = z.object({ ok: z.literal(true) });
const DailyCountSchema = z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), count: z.number().int().nonnegative() });
const UserStatsSchema = z.object({
  users: z.object({
    total: z.number().int().nonnegative(), admins: z.number().int().nonnegative(), banned: z.number().int().nonnegative(),
    new_7d: z.number().int().nonnegative(), new_30d: z.number().int().nonnegative(), active_7d: z.number().int().nonnegative(),
    with_profile: z.number().int().nonnegative(),
    visibility: z.object({ private: z.number().int().nonnegative(), friends: z.number().int().nonnegative(), public: z.number().int().nonnegative() }),
  }),
  signups_by_day: z.array(DailyCountSchema),
  visits: z.object({
    total: z.number().int().nonnegative(), last_30d: z.number().int().nonnegative(),
    by_method: z.object({ route: z.number().int().nonnegative(), checkin: z.number().int().nonnegative() }),
    by_day: z.array(DailyCountSchema),
    top_works: z.array(z.object({ work_slug: z.string(), count: z.number().int().positive() }).strict()).max(5),
  }),
  photos: z.object({
    by_review: z.object({ pending: z.number().int().nonnegative(), approved: z.number().int().nonnegative(), rejected: z.number().int().nonnegative(), none: z.number().int().nonnegative() }),
    archive_suggested: z.number().int().nonnegative(),
  }),
  reports: z.object({ by_status: z.object({ pending: z.number().int().nonnegative(), approved: z.number().int().nonnegative(), rejected: z.number().int().nonnegative() }) }),
  friendships: z.object({ accepted: z.number().int().nonnegative(), pending: z.number().int().nonnegative() }),
});
export type UserStats = z.infer<typeof UserStatsSchema>;

export type ManagedUser = z.infer<typeof UserSchema>;
export type UserAction =
  | { action: 'set_role'; user_id: string; admin: boolean }
  | { action: 'ban'; user_id: string; banned: boolean }
  | { action: 'delete'; user_id: string };

export function useUserStats() {
  return useQuery({
    queryKey: ['admin-user-stats'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('admin-users', { body: { action: 'stats' } });
      if (error) throw error;
      return UserStatsSchema.parse(data);
    },
    staleTime: 60_000,
  });
}

export function useUsers() {
  return useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('admin-users', { body: { action: 'list' } });
      if (error) throw error;
      return ListSchema.parse(data).users;
    },
  });
}

export function useUserAction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: UserAction) => {
      const { data, error } = await supabase.functions.invoke('admin-users', { body });
      if (error) throw error;
      return OkSchema.parse(data);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-users'] }),
  });
}

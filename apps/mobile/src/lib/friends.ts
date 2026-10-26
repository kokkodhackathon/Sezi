import { FriendshipRowSchema } from '@sezi/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { z } from 'zod';

import { useAccount } from './account';
import { supabase } from './supabase';

const BlockSchema = z.object({
  blocker: z.string().uuid(),
  blocked: z.string().uuid(),
  created_at: z.string(),
});

export function useFriendships() {
  const { user } = useAccount();
  return useQuery({
    queryKey: ['friendships', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('friendships')
        .select('id,requester,addressee,status,created_at')
        .or(`requester.eq.${user!.id},addressee.eq.${user!.id}`)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return z.array(FriendshipRowSchema).parse(data);
    },
  });
}

export function useBlocks() {
  const { user } = useAccount();
  return useQuery({
    queryKey: ['blocks', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('blocks')
        .select('blocker,blocked,created_at')
        .eq('blocker', user!.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return z.array(BlockSchema).parse(data);
    },
  });
}

export function useIncomingCount(): number {
  const { user } = useAccount();
  const { data, refetch } = useQuery({
    queryKey: ['friendships', user?.id, 'incoming-count'],
    enabled: !!user,
    queryFn: async () => {
      const { count, error } = await supabase
        .from('friendships')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending')
        .eq('addressee', user!.id);
      if (error) throw error;
      return count ?? 0;
    },
  });
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active' && user) void refetch();
    });
    return () => subscription.remove();
  }, [refetch, user]);
  return data ?? 0;
}

/** İşlemler RLS ile sınırlandırılır; değişen görünürlükte eski kişi içeriği tutulmaz. */
export function useFriendActions() {
  const qc = useQueryClient();
  const { user } = useAccount();
  const refresh = async () => {
    qc.removeQueries({ queryKey: ['person-visits'] });
    qc.removeQueries({ queryKey: ['photos'] });
    qc.removeQueries({ queryKey: ['photo-urls'] });
    await Promise.all(
      ['friendships', 'blocks', 'contributions', 'person', 'people'].map((key) =>
        qc.invalidateQueries({ queryKey: [key] }),
      ),
    );
  };
  const run = async (operation: () => PromiseLike<{ error: unknown }>) => {
    if (!user) throw new Error('Authentication required');
    const { error } = await operation();
    if (error) throw error;
    await refresh();
  };
  return {
    sendRequest: (uid: string) => run(() => supabase.from('friendships').insert({ addressee: uid })),
    accept: (id: string) =>
      run(() => supabase.from('friendships').update({ status: 'accepted' }).eq('id', id)),
    removeFriendship: (id: string) => run(() => supabase.from('friendships').delete().eq('id', id)),
    block: (uid: string) => run(() => supabase.from('blocks').insert({ blocked: uid })),
    unblock: (uid: string) =>
      run(() => supabase.from('blocks').delete().eq('blocker', user!.id).eq('blocked', uid)),
  };
}

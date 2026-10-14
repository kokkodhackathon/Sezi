import type { Session } from '@supabase/supabase-js';
import { useEffect, useState, type ReactNode } from 'react';

import { AuthContext as Ctx } from './auth-context';
import { supabase } from './supabase';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  const isAdmin = session?.user.app_metadata?.role === 'admin';
  const signOut = async () => {
    await supabase.auth.signOut();
  };
  return <Ctx.Provider value={{ session, loading, isAdmin, signOut }}>{children}</Ctx.Provider>;
}

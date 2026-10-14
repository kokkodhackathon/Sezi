import type { Session } from '@supabase/supabase-js';
import { createContext, useContext } from 'react';

export interface AuthState {
  session: Session | null;
  loading: boolean;
  /** JWT'deki rol; RLS de aynı alana bakar (public.is_admin()). */
  isAdmin: boolean;
  signOut: () => Promise<void>;
}

export const AuthContext = createContext<AuthState | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth, AuthProvider içinde kullanılmalı');
  return ctx;
}

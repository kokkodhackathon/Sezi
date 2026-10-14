import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
if (!url || !key) throw new Error('VITE_SUPABASE_URL ve VITE_SUPABASE_ANON_KEY tanımlı olmalı (apps/admin/.env)');

/**
 * Admin paneli istemci tarafında yalnızca anonim/publishable anahtar kullanır.
 * Yazma yetkisi RLS'tedir: JWT'de app_metadata.role = 'admin' olan kullanıcı yazabilir.
 */
export const supabase = createClient(url, key, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

export const MEDIA_BASE = `${url}/storage/v1/object/public/media/`;

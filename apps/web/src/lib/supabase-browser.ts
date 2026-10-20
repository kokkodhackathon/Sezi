"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Tarayıcıdaki tek Supabase istemcisi (hesap, bildirim). Oturum localStorage'da (supabase-js varsayılanı).
 * Kayıt, giriş ve şifre işlemleri e-postadaki 6 haneli kodla yapılır; yönlendirme adresi gerekmez.
 */
let client: SupabaseClient | null = null;

export function browserSupabase(): SupabaseClient {
  client ??= createClient(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "", process.env.NEXT_PUBLIC_SUPABASE_KEY ?? "", {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
  });
  return client;
}

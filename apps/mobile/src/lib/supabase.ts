import { createClient, processLock } from '@supabase/supabase-js';
import Storage from 'expo-sqlite/kv-store';
import { AppState } from 'react-native';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
// Boş bırakılan publishable satırı (.env.example kopyası) anon anahtarına düşer: `??` değil `||`.
const key = process.env.EXPO_PUBLIC_SUPABASE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key) {
  throw new Error('EXPO_PUBLIC_SUPABASE_URL ve EXPO_PUBLIC_SUPABASE_KEY apps/mobile/.env içinde tanımlı olmalı');
}

/**
 * Keşif hesapsız (anon) çalışır. Hesap isteğe bağlıdır: oturum cihazda (kv-store) saklanır, uygulama
 * öndeyken anahtar yenilenir. E-posta akışları kodla yürüdüğü için URL'den oturum okunmaz.
 */
export const supabase = createClient(url, key, {
  auth: { storage: Storage, persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, lock: processLock },
});

// Arka planda yenileme durur (React Native'de zamanlayıcı güvenilmez); öne gelince sürer.
AppState.addEventListener('change', (state) => {
  if (state === 'active') void supabase.auth.startAutoRefresh();
  else void supabase.auth.stopAutoRefresh();
});

/** Admin panelinden yüklenen ses kayıtlarının (nokta, eser) genel adresi. */
export const AUDIO_BASE = `${url}/storage/v1/object/public/audio/`;

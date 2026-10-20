import { AccountRowSchema, KNOWN_AUTH_ERRORS, PrefsSchema, type AccountRow, type KnownAuthError, type Prefs, type UserProfile } from '@sezi/shared';
import { isAuthApiError, isAuthRetryableFetchError, type Session, type User } from '@supabase/supabase-js';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Storage from 'expo-sqlite/kv-store';
import { createContext, useContext, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { z } from 'zod';

import type { Lang, MessageKey } from './i18n';
import { useProfile } from './profile';
import { useSettings } from './settings';
import { SESSION_KEY, supabase } from './supabase';

/**
 * İsteğe bağlı hesap. Uygulama hesapsız tam çalışır; hesap açılışta sorulmaz, Profil → Hesap'tan açılır.
 *
 * - Kimlik: e-posta + şifre; doğrulama, şifre sıfırlama ve şifre değişimi e-postaya gelen 6 haneli kodla
 *   (derin bağlantı yok). Oturum cihazda saklanır (`lib/supabase.ts`).
 * - `accounts` satırı (RLS: yalnız sahibi): tercihler. İlk girişte istemci ekler. Ad, @kullanıcı adı ve fotoğraf
 *   ayrı tabloda (`profiles`, `lib/identity.ts`).
 * - Tercihler (erişilebilirlik profili + `SyncedSettings`) cihazlar arasında taşınır. Cihaz her zaman
 *   kaynaktır; sunucu eşidir. Yeni girişte hesaptaki tercih bu cihaza gelir; sonra en yeni değişiklik kazanır.
 *   İnternet yoksa değişiklik `dirty` kalır, uygulama öne gelince gönderilir.
 */

const COLUMNS = 'user_id, prefs, prefs_updated_at';
// ---------- Cihazdaki eşitleme kaydı ----------

const META_KEY = 'sezi.prefs.meta.v1';
const ACCOUNT_KEY = 'sezi.account.v1';
/** Kimlik önbelleği (`lib/identity.ts`): çıkışta ve silmede bununla birlikte temizlenir. */
export const IDENTITY_KEY = 'sezi.identity.v1';
const MetaSchema = z.object({
  /** Son eşitlenen ya da yerelde değişen tercihlerin JSON'u. */
  snapshot: z.string().nullable(),
  /** Tercihin değiştiği an (ISO). */
  updatedAt: z.string().nullable(),
  /** Yerel değişiklik sunucuya gitmedi. */
  dirty: z.boolean(),
});
type Meta = z.infer<typeof MetaSchema>;
const EMPTY_META: Meta = { snapshot: null, updatedAt: null, dirty: false };

function readJson<T>(key: string, schema: z.ZodType<T, z.ZodTypeDef, unknown>): T | null {
  try {
    const raw = Storage.getItemSync(key);
    if (!raw) return null;
    const parsed = schema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

function snapshotOf(profile: UserProfile, settings: unknown): string {
  return JSON.stringify(PrefsSchema.parse({ profile, settings }));
}

// Eşitleme kaydı modül deposudur (useSyncExternalStore): efektler yazar, ekranlar okur.
let metaCache: Meta = readJson(META_KEY, MetaSchema) ?? EMPTY_META;
const metaListeners = new Set<() => void>();
function writeMeta(m: Meta) {
  metaCache = m;
  Storage.setItemSync(META_KEY, JSON.stringify(m));
  metaListeners.forEach((l) => l());
}
function subscribeMeta(l: () => void) {
  metaListeners.add(l);
  return () => {
    metaListeners.delete(l);
  };
}
const getMeta = () => metaCache;

/** Yeni giriş: eşitleme bu cihazı hesaptaki tercihlerle günceller (birleştirme değil). */
let freshSignIn = false;

// ---------- Hata iletileri ----------

const isKnown = (c: string | undefined): c is KnownAuthError => !!c && (KNOWN_AUTH_ERRORS as readonly string[]).includes(c);

/** Auth hatasını kullanıcı iletisine çevirir; bilinmeyen hata genel iletiye düşer. */
export function errorKey(e: unknown): MessageKey {
  if (isAuthRetryableFetchError(e)) return 'account.err.network';
  if (isAuthApiError(e) && isKnown(e.code)) return `account.err.${e.code}`;
  if (e instanceof TypeError) return 'account.err.network'; // fetch: ağ yok
  return 'account.err.generic';
}

/** Hata kodu (ör. giriş ekranında doğrulanmamış e-posta ayrımı). */
export function errorCode(e: unknown): string | undefined {
  return isAuthApiError(e) ? e.code : undefined;
}

// ---------- Eylemler ----------

export async function signUp(input: { name: string; email: string; password: string; lang: Lang }) {
  const { error } = await supabase.auth.signUp({
    email: input.email,
    password: input.password,
    // lang: e-posta şablonlarının dili; display_name ilk girişte profiles satırına taşınır.
    options: { data: { display_name: input.name, lang: input.lang } },
  });
  if (error) throw error;
}

export async function resendSignupCode(email: string) {
  const { error } = await supabase.auth.resend({ type: 'signup', email });
  if (error) throw error;
}

export async function verifySignup(email: string, code: string) {
  freshSignIn = true;
  const { error } = await supabase.auth.verifyOtp({ email, token: code, type: 'signup' });
  if (error) {
    freshSignIn = false;
    throw error;
  }
}

export async function signIn(email: string, password: string) {
  freshSignIn = true;
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    freshSignIn = false;
    throw error;
  }
}

export async function requestPasswordReset(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email);
  if (error) throw error;
}

/** Sıfırlama kodu doğrulanınca oturum açılır; yeni şifre hemen ardından belirlenir. */
export async function verifyPasswordReset(email: string, code: string) {
  freshSignIn = true;
  const { error } = await supabase.auth.verifyOtp({ email, token: code, type: 'recovery' });
  if (error) {
    freshSignIn = false;
    throw error;
  }
}

/** Giriş yapmış kullanıcının şifre değişimi için e-postaya onay kodu (sunucu `secure_password_change`). */
export async function sendPasswordChangeCode() {
  const { error } = await supabase.auth.reauthenticate();
  if (error) throw error;
}

/** `nonce`: e-postadaki onay kodu. Sıfırlamadan hemen sonra (yeni oturum) gerekmez. */
export async function setPassword(password: string, nonce?: string) {
  const { error } = await supabase.auth.updateUser(nonce ? { password, nonce } : { password });
  if (error) throw error;
}

/**
 * Yalnız bu cihazda çıkış; tercihler cihazda kalır. İnternet yokken Supabase sunucuya haber veremez:
 * oturum geçerliyse yine de yerelde siler (hata yok sayılır), süresi dolmuşsa yenileyemediği için oturumu
 * yerinde bırakır. Bu yüzden başarı yalnız cihazdaki oturum gerçekten silindiyse bildirilir; değilse hata atılır.
 */
export async function signOut() {
  const { error } = await supabase.auth.signOut({ scope: 'local' });
  if (Storage.getItemSync(SESSION_KEY)) throw error ?? new Error('sign-out: local session kept');
  Storage.removeItemSync(ACCOUNT_KEY);
  Storage.removeItemSync(IDENTITY_KEY);
}

/** Hesap ve hesaba bağlı veriler sunucudan silinir (edge function `delete-account`); cihazdaki tercihler kalır. */
export async function deleteAccount() {
  const { error } = await supabase.functions.invoke('delete-account', { method: 'POST' });
  if (error) throw error;
  // Kullanıcı sunucuda yok: yerel oturumu kapat (sunucuya istek atmaz).
  await supabase.auth.signOut({ scope: 'local' });
  Storage.removeItemSync(ACCOUNT_KEY);
  Storage.removeItemSync(IDENTITY_KEY);
}

// ---------- Bağlam ----------

interface AccountContextValue {
  /** Kayıtlı oturum okundu (ilk açılışta kısa süre false). */
  ready: boolean;
  session: Session | null;
  user: User | null;
  /** Sunucudaki hesap satırı (internetsizken son bilinen hâl). */
  account: AccountRow | null;
  /** Yerel tercih değişikliği sunucuya henüz gitmedi. */
  pending: boolean;
}

const Ctx = createContext<AccountContextValue | null>(null);

export function AccountProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const { profile, saveProfile } = useProfile();
  const { settings, update } = useSettings();
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const meta = useSyncExternalStore(subscribeMeta, getMeta);
  const user = session?.user ?? null;
  const uid = user?.id;

  // Oturum: ilk olay (INITIAL_SESSION) kayıtlı oturumu getirir. Geri çağrıda Supabase isteği atılmaz (kilit).
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setReady(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const accountQuery = useQuery({
    queryKey: ['account', uid],
    enabled: !!uid,
    queryFn: async () => {
      const { data, error } = await supabase.from('accounts').select(COLUMNS).eq('user_id', uid!).maybeSingle();
      if (error) throw error;
      const row = data ? AccountRowSchema.parse(data) : null;
      if (row) Storage.setItemSync(ACCOUNT_KEY, JSON.stringify(row));
      return row;
    },
    // İnternetsiz açılışta ad ve durum son bilinen satırdan gelir; eşitleme yalnız sunucu yanıtıyla yapılır.
    placeholderData: () => {
      const last = readJson(ACCOUNT_KEY, AccountRowSchema);
      return last && last.user_id === uid ? last : undefined;
    },
  });
  const row = accountQuery.isPlaceholderData ? undefined : accountQuery.data;
  // Aynı satır yeniden gelirse `row` referansı değişmez (structural sharing); bekleyen gönderim
  // her başarılı okumada yeniden denensin diye eşitleme bu zamana da bağlıdır.
  const fetchedAt = accountQuery.dataUpdatedAt;

  // Yerel değişiklik izleme (hesap olsun olmasın): tercih değişince zaman damgası alınır.
  const snapshot = profile ? snapshotOf(profile, settings) : null;
  useEffect(() => {
    if (!snapshot || metaCache.snapshot === snapshot) return;
    writeMeta({ snapshot, updatedAt: new Date().toISOString(), dirty: true });
  }, [snapshot]);

  // Sunucuyla eşitleme: hesap satırı geldiğinde ve yerelde değişiklik olduğunda.
  useEffect(() => {
    if (!uid || !user || row === undefined || fetchedAt === 0 || !meta.snapshot) return;
    const local = meta;
    const localPrefs = PrefsSchema.parse(JSON.parse(local.snapshot!));
    let cancelled = false;

    const store = (next: AccountRow) => {
      Storage.setItemSync(ACCOUNT_KEY, JSON.stringify(next));
      qc.setQueryData(['account', uid], next);
    };
    const markSynced = (at: string | null) => {
      const cur = metaCache;
      if (cur.snapshot === local.snapshot) writeMeta({ ...cur, updatedAt: at ?? cur.updatedAt, dirty: false });
    };
    // E-posta şablonlarının dili profil diliyle aynı kalır.
    const syncLang = () => {
      const lang = localPrefs.profile.lang;
      if (z.string().safeParse(user.user_metadata?.lang).data !== lang) void supabase.auth.updateUser({ data: { lang } });
    };
    const apply = (p: Prefs, at: string) => {
      writeMeta({ snapshot: snapshotOf(p.profile, p.settings), updatedAt: at, dirty: false });
      saveProfile(p.profile);
      update(p.settings);
    };
    const push = async () => {
      const at = local.updatedAt ?? new Date().toISOString();
      const { data, error } = await supabase.from('accounts').update({ prefs: localPrefs, prefs_updated_at: at }).eq('user_id', uid).select(COLUMNS).single();
      if (cancelled || error) return; // internet yok: dirty kalır, öne gelince yeniden denenir
      store(AccountRowSchema.parse(data));
      markSynced(at);
      syncLang();
    };

    void (async () => {
      if (row === null) {
        // İlk giriş: hesap satırını bu cihazın tercihleriyle oluştur.
        freshSignIn = false;
        const at = local.updatedAt ?? new Date().toISOString();
        const { data, error } = await supabase
          .from('accounts')
          .insert({ user_id: uid, prefs: localPrefs, prefs_updated_at: at })
          .select(COLUMNS)
          .single();
        if (cancelled) return;
        if (error) {
          // Başka cihaz aynı anda eklediyse satırı yeniden oku.
          if (error.code === '23505') void qc.invalidateQueries({ queryKey: ['account', uid] });
          return;
        }
        store(AccountRowSchema.parse(data));
        markSynced(at);
        syncLang();
        return;
      }
      const server = PrefsSchema.safeParse(row.prefs);
      const serverAt = row.prefs_updated_at ? Date.parse(row.prefs_updated_at) : 0;
      const localAt = local.updatedAt ? Date.parse(local.updatedAt) : 0;
      if (freshSignIn) {
        freshSignIn = false;
        if (server.success && row.prefs_updated_at) return apply(server.data, row.prefs_updated_at);
        return push();
      }
      if (server.success && row.prefs_updated_at && serverAt > localAt) return apply(server.data, row.prefs_updated_at);
      if (local.dirty || !server.success) return push();
    })();
    return () => {
      cancelled = true;
    };
  }, [uid, user, row, fetchedAt, meta, qc, saveProfile, update]);

  // Öne gelince hesap satırı yenilenir (başka cihazdaki değişiklik, bekleyen gönderim).
  useEffect(() => {
    if (!uid) return;
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') void qc.invalidateQueries({ queryKey: ['account', uid] });
    });
    return () => sub.remove();
  }, [uid, qc]);

  const value = useMemo<AccountContextValue>(
    () => ({ ready, session, user, account: accountQuery.data ?? null, pending: !!uid && meta.dirty }),
    [ready, session, user, accountQuery.data, uid, meta.dirty],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAccount() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAccount, AccountProvider içinde kullanılmalı');
  return ctx;
}

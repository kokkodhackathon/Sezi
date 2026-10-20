"use client";

import {
  AccountRowSchema,
  KNOWN_AUTH_ERRORS,
  PrefsSchema,
  profileFor,
  SyncedSettings,
  type AccountRow,
  type KnownAuthError,
} from "@sezi/shared";
import { isAuthApiError, isAuthRetryableFetchError, type Session, type User } from "@supabase/supabase-js";
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";

import type { Lang, MessageKey } from "./i18n";
import { useT } from "./i18n-client";
import { clearIdentityCache, ensureIdentityLoaded } from "./identity";
import { applyRemoteProfile, localProfile, subscribeProfileEdits } from "./profile";
import { browserSupabase } from "./supabase-browser";

/**
 * İsteğe bağlı hesap (mobille aynı kurallar). Site hesapsız tam çalışır.
 * Oturum `onAuthStateChange` ile izlenir; ilk olay kayıtlı oturumu getirir.
 * Giriş yapıldığında `accounts` satırı okunur (yoksa oluşturulur) ve erişilebilirlik profili eşitlenir.
 */
const COLUMNS = "user_id, prefs, prefs_updated_at";

function sessionStorageKey(): string {
  try {
    const host = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").hostname;
    const ref = host.split(".")[0];
    return ref ? `sb-${ref}-auth-token` : "sb-auth-token";
  } catch {
    return "sb-auth-token";
  }
}

const isKnown = (c: string | undefined): c is KnownAuthError =>
  !!c && (KNOWN_AUTH_ERRORS as readonly string[]).includes(c);

/** Auth hatasını kullanıcı iletisine çevirir; bilinmeyen hata genel iletiye düşer. */
export function errorKey(e: unknown): MessageKey {
  if (isAuthRetryableFetchError(e)) return "account.err.network";
  if (isAuthApiError(e) && isKnown(e.code)) return `account.err.${e.code}`;
  if (e instanceof TypeError) return "account.err.network";
  return "account.err.generic";
}

/** Hata kodu (ör. giriş ekranında doğrulanmamış e-posta ayrımı). */
export function errorCode(e: unknown): string | undefined {
  return isAuthApiError(e) ? e.code : undefined;
}

export async function signUp(input: { name: string; email: string; password: string; lang: Lang }) {
  const { error } = await browserSupabase().auth.signUp({
    email: input.email,
    password: input.password,
    options: { data: { display_name: input.name, lang: input.lang } },
  });
  if (error) throw error;
}

export async function resendSignupCode(email: string) {
  const { error } = await browserSupabase().auth.resend({ type: "signup", email });
  if (error) throw error;
}

export async function verifySignup(email: string, code: string) {
  const { error } = await browserSupabase().auth.verifyOtp({ email, token: code, type: "signup" });
  if (error) throw error;
}

export async function signIn(email: string, password: string) {
  const { error } = await browserSupabase().auth.signInWithPassword({ email, password });
  if (error) throw error;
}

export async function requestPasswordReset(email: string) {
  const { error } = await browserSupabase().auth.resetPasswordForEmail(email);
  if (error) throw error;
}

/** Sıfırlama kodu doğrulanınca oturum açılır; yeni şifre hemen ardından belirlenir. */
export async function verifyPasswordReset(email: string, code: string) {
  const { error } = await browserSupabase().auth.verifyOtp({ email, token: code, type: "recovery" });
  if (error) throw error;
}

/** Giriş yapmış kullanıcının şifre değişimi için e-postaya onay kodu (`secure_password_change`). */
export async function sendPasswordChangeCode() {
  const { error } = await browserSupabase().auth.reauthenticate();
  if (error) throw error;
}

/** `nonce`: e-postadaki onay kodu. Sıfırlamadan hemen sonra (yeni oturum) gerekmez. */
export async function setPassword(password: string, nonce?: string) {
  const { error } = await browserSupabase().auth.updateUser(nonce ? { password, nonce } : { password });
  if (error) throw error;
}

/**
 * Yalnız bu cihazda çıkış; tercihler cihazda kalır. Süresi dolmuş oturum internetsiz kapatılamadığında
 * localStorage'daki oturum anahtarı yerinde kalır; o durumda hata fırlatılır.
 */
export async function signOut() {
  const { error } = await browserSupabase().auth.signOut({ scope: "local" });
  if (typeof window !== "undefined" && localStorage.getItem(sessionStorageKey())) {
    throw error ?? new Error("sign-out: local session kept");
  }
  clearIdentityCache();
}

/** Hesap ve hesaba bağlı veriler sunucudan silinir (`delete-account`); cihazdaki tercihler kalır. */
export async function deleteAccount() {
  const supabase = browserSupabase();
  const { error } = await supabase.functions.invoke("delete-account", { method: "POST" });
  if (error) throw error;
  await supabase.auth.signOut({ scope: "local" });
  if (typeof window !== "undefined") {
    localStorage.removeItem(sessionStorageKey());
  }
  clearIdentityCache();
}

interface AccountContextValue {
  /** Kayıtlı oturum okundu (ilk açılışta kısa süre false). */
  ready: boolean;
  session: Session | null;
  user: User | null;
  /** Sunucudaki hesap satırı. */
  account: AccountRow | null;
  /** Yerel tercih değişikliği sunucuya henüz gitmedi. */
  pending: boolean;
}

const Ctx = createContext<AccountContextValue | null>(null);

export function AccountProvider({ children }: { children: ReactNode }) {
  const { t, lang } = useT();
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [account, setAccount] = useState<AccountRow | null>(null);
  const [pending, setPending] = useState(false);

  const langRef = useRef(lang);
  langRef.current = lang;
  const tRef = useRef(t);
  tRef.current = t;
  const settingsRef = useRef<SyncedSettings | null>(null);
  const initPromiseRef = useRef<Promise<void> | null>(null);

  const user = session?.user ?? null;
  const uid = user?.id ?? null;

  useEffect(() => {
    const { data } = browserSupabase().auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setReady(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  // Giriş yapıldığında `accounts` ve `profiles` satırlarını hazırla ve sunucudaki profili uygula.
  useEffect(() => {
    void ensureIdentityLoaded(user);
    if (!uid) {
      settingsRef.current = null;
      initPromiseRef.current = null;
      setAccount(null);
      setPending(false);
      return;
    }
    let cancelled = false;
    const supabase = browserSupabase();

    const applyRow = (raw: unknown) => {
      const row = AccountRowSchema.parse(raw);
      setAccount(row);
      const parsed = PrefsSchema.safeParse(row.prefs);
      if (parsed.success) {
        settingsRef.current = parsed.data.settings;
        applyRemoteProfile(parsed.data.profile);
      } else {
        settingsRef.current = SyncedSettings.parse({});
      }
    };

    const p = (async () => {
      const { data, error } = await supabase.from("accounts").select(COLUMNS).eq("user_id", uid).maybeSingle();
      if (cancelled || error) return;
      if (!data) {
        const settings = SyncedSettings.parse({});
        const profile = localProfile() ?? profileFor("walker", langRef.current);
        const now = new Date().toISOString();
        const inserted = await supabase
          .from("accounts")
          .insert({ user_id: uid, prefs: { profile, settings }, prefs_updated_at: now })
          .select(COLUMNS)
          .single();
        if (cancelled) return;
        if (inserted.error) {
          if (inserted.error.code === "23505") {
            const retry = await supabase.from("accounts").select(COLUMNS).eq("user_id", uid).maybeSingle();
            if (!cancelled && retry.data) applyRow(retry.data);
          }
          return;
        }
        settingsRef.current = settings;
        setAccount(AccountRowSchema.parse(inserted.data));
        return;
      }
      applyRow(data);
    })();

    initPromiseRef.current = p;
    return () => {
      cancelled = true;
    };
  }, [uid, user]);

  // Profil düzenlendiğinde sunucudaki `settings` korunarak `accounts.prefs` güncellenir.
  useEffect(() => {
    if (!uid) return;
    return subscribeProfileEdits((nextProfile) => {
      void (async () => {
        if (initPromiseRef.current) {
          await initPromiseRef.current.catch(() => undefined);
        }
        const supabase = browserSupabase();
        let settings = settingsRef.current;
        if (!settings) {
          const existing = await supabase.from("accounts").select(COLUMNS).eq("user_id", uid).maybeSingle();
          const parsed = existing.data ? PrefsSchema.safeParse(AccountRowSchema.parse(existing.data).prefs) : null;
          settings = parsed?.success ? parsed.data.settings : SyncedSettings.parse({});
          settingsRef.current = settings;
        }
        setPending(true);
        const now = new Date().toISOString();
        const { data, error } = await supabase
          .from("accounts")
          .update({ prefs: { profile: nextProfile, settings }, prefs_updated_at: now })
          .eq("user_id", uid)
          .select(COLUMNS)
          .single();
        if (error) {
          toast.error(tRef.current("profile.syncFailed"));
          return;
        }
        setPending(false);
        setAccount(AccountRowSchema.parse(data));
      })();
    });
  }, [uid]);

  const value = useMemo<AccountContextValue>(
    () => ({ ready, session, user, account, pending }),
    [ready, session, user, account, pending],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAccount(): AccountContextValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAccount, AccountProvider içinde kullanılmalı");
  return ctx;
}

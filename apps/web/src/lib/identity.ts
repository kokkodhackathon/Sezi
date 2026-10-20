"use client";

import { fallbackDisplayName, IdentitySchema, type Identity, type IdentityPatch } from "@sezi/shared";
import type { User } from "@supabase/supabase-js";
import { useCallback, useEffect, useSyncExternalStore } from "react";
import { z } from "zod";

import { errorKey, useAccount } from "./account";
import type { MessageKey } from "./i18n";
import { browserSupabase } from "./supabase-browser";

/**
 * Hesabın kimliği (`profiles`): görünen ad, @kullanıcı adı, profil fotoğrafı, baş harf rengi ve görünürlük.
 * Tercihlerden (`accounts`, yalnız sahibi) ayrıdır; `public` profili girişli herkes görebilir.
 * Satır ilk girişte istemci tarafından açılır (RLS). Fotoğraf özel `avatars` kovasından imzalı URL ile okunur.
 */
const COLUMNS = "user_id, display_name, username, avatar_path, avatar_tone, visibility";
export const IDENTITY_KEY = "sezi.web.identity.v1";
const AVATAR_SIZE = 512;

const UniqueViolation = z.object({ code: z.literal("23505") });

/** Kimlik hatası → ileti: alınmış kullanıcı adı ayrı; gerisi hesap hatalarıyla aynı. */
export function identityErrorKey(e: unknown): MessageKey {
  if (UniqueViolation.safeParse(e).success) return "account.err.username_taken";
  return errorKey(e);
}

/** Baş harfler: adın ilk iki kelimesi (Türkçe büyük harf kuralıyla). */
export function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w.charAt(0).toLocaleUpperCase("tr"))
    .join("");
}

interface IdentityState {
  uid: string | null;
  identity: Identity | null;
  avatar: string | null;
  loading: boolean;
}
const EMPTY_STATE: IdentityState = { uid: null, identity: null, avatar: null, loading: false };
let state: IdentityState = EMPTY_STATE;
let inFlightUid: string | null = null;
let inFlightPromise: Promise<void> | null = null;
const listeners = new Set<() => void>();

function setState(next: IdentityState) {
  state = next;
  for (const listener of listeners) {
    listener();
  }
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

const getSnapshot = () => state;
const getServerSnapshot = () => EMPTY_STATE;

function readCached(uid: string): Identity | null {
  if (typeof window === "undefined") return null;
  try {
    const parsed = IdentitySchema.safeParse(JSON.parse(localStorage.getItem(IDENTITY_KEY) ?? "null"));
    return parsed.success && parsed.data.user_id === uid ? parsed.data : null;
  } catch {
    return null;
  }
}

function writeCached(row: Identity) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(IDENTITY_KEY, JSON.stringify(row));
  } catch {
    // localStorage dolu ya da kapalıysa sessizce geç
  }
}

export function clearIdentityCache() {
  if (typeof window !== "undefined") {
    try {
      localStorage.removeItem(IDENTITY_KEY);
    } catch {
      // yok say
    }
  }
  inFlightUid = null;
  inFlightPromise = null;
  setState(EMPTY_STATE);
}

async function resolveAvatarUrl(path: string | null): Promise<string | null> {
  if (!path) return null;
  const { data, error } = await browserSupabase().storage.from("avatars").createSignedUrl(path, 3600);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

/** Oturum açıldığında profil satırını okur (yoksa oluşturur) ve modül deposuna yazar. */
export function ensureIdentityLoaded(user: User | null): Promise<void> {
  if (!user) {
    if (state.uid !== null || state.identity !== null) {
      inFlightUid = null;
      inFlightPromise = null;
      setState(EMPTY_STATE);
    }
    return Promise.resolve();
  }
  const uid = user.id;
  if (state.uid === uid && state.identity && !state.loading) {
    return Promise.resolve();
  }
  if (inFlightUid === uid && inFlightPromise) {
    return inFlightPromise;
  }
  const cached = readCached(uid);
  setState({ uid, identity: cached, avatar: state.uid === uid ? state.avatar : null, loading: !cached });
  inFlightUid = uid;
  const supabase = browserSupabase();

  const p = (async () => {
    try {
      const read = () => supabase.from("profiles").select(COLUMNS).eq("user_id", uid).maybeSingle();
      let { data, error } = await read();
      if (error) throw error;
      if (!data) {
        const name = fallbackDisplayName(user.user_metadata?.display_name, user.email);
        const inserted = await supabase.from("profiles").insert({ user_id: uid, display_name: name }).select(COLUMNS).single();
        if (inserted.error && !UniqueViolation.safeParse(inserted.error).success) throw inserted.error;
        ({ data, error } = inserted.error ? await read() : inserted);
        if (error) throw error;
      }
      const row = IdentitySchema.parse(data);
      writeCached(row);
      const avatar = await resolveAvatarUrl(row.avatar_path);
      if (inFlightUid === uid) {
        setState({ uid, identity: row, avatar, loading: false });
      }
    } catch {
      if (inFlightUid === uid) {
        setState({ uid, identity: cached, avatar: null, loading: false });
      }
    } finally {
      if (inFlightUid === uid) {
        inFlightPromise = null;
      }
    }
  })();

  inFlightPromise = p;
  return p;
}

/** Seçilen görseli ortadan kare kırpıp 512×512 JPEG (0.85) Blob'a dönüştürür. */
async function cropSquareJpeg(file: File): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  try {
    const side = Math.min(bmp.width, bmp.height);
    const sx = Math.floor((bmp.width - side) / 2);
    const sy = Math.floor((bmp.height - side) / 2);
    const canvas = document.createElement("canvas");
    canvas.width = AVATAR_SIZE;
    canvas.height = AVATAR_SIZE;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas 2d context unavailable");
    ctx.drawImage(bmp, sx, sy, side, side, 0, 0, AVATAR_SIZE, AVATAR_SIZE);
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("jpeg encode failed"))),
        "image/jpeg",
        0.85,
      );
    });
  } finally {
    bmp.close();
  }
}

export interface IdentityController {
  identity: Identity | null;
  avatar: string | null;
  loading: boolean;
  save: (patch: IdentityPatch) => Promise<void>;
  setAvatar: (file: File) => Promise<void>;
  removeAvatar: () => Promise<void>;
}

export function useIdentity(): IdentityController {
  const { user } = useAccount();
  const uid = user?.id ?? null;
  const snap = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  useEffect(() => {
    void ensureIdentityLoaded(user);
  }, [user]);

  const updateRow = useCallback(
    async (patch: Record<string, string | null>, nextAvatarUrl?: string | null) => {
      if (!uid) return;
      const { data, error } = await browserSupabase().from("profiles").update(patch).eq("user_id", uid).select(COLUMNS).single();
      if (error) throw error;
      const row = IdentitySchema.parse(data);
      writeCached(row);
      const avatar = nextAvatarUrl !== undefined ? nextAvatarUrl : snap.avatar;
      setState({ uid, identity: row, avatar, loading: false });
    },
    [uid, snap.avatar],
  );

  const save = useCallback((patch: IdentityPatch) => updateRow(patch), [updateRow]);

  /** Seçilen fotoğraf ortadan kare kırpılıp 512 px JPEG olarak yüklenir; eski dosya silinir. */
  const setAvatar = useCallback(
    async (file: File) => {
      if (!uid) return;
      const blob = await cropSquareJpeg(file);
      const path = `${uid}/${Date.now()}.jpg`;
      const supabase = browserSupabase();
      const up = await supabase.storage.from("avatars").upload(path, blob, { contentType: "image/jpeg" });
      if (up.error) throw up.error;
      const old = state.identity?.avatar_path ?? null;
      const signed = await resolveAvatarUrl(path);
      await updateRow({ avatar_path: path }, signed);
      if (old) void supabase.storage.from("avatars").remove([old]);
    },
    [uid, updateRow],
  );

  const removeAvatar = useCallback(async () => {
    const old = state.identity?.avatar_path ?? null;
    if (!old) return;
    await updateRow({ avatar_path: null }, null);
    void browserSupabase().storage.from("avatars").remove([old]);
  }, [updateRow]);

  const identity = snap.uid === uid ? snap.identity : null;
  const avatar = snap.uid === uid ? snap.avatar : null;
  const loading = snap.uid === uid ? snap.loading : !!uid;
  return { identity, avatar, loading, save, setAvatar, removeAvatar };
}

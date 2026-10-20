"use client";

import { UserProfile } from "@sezi/shared";
import { useSyncExternalStore } from "react";

/**
 * Erişilebilirlik profili bu tarayıcıda saklanır (`sezi.web.profile.v1`); hesapsız da rota ve turlar buna göre
 * hesaplanır. Giriş yapılmışsa `AccountProvider` kullanıcının yaptığı değişikliği hesaba gönderir
 * (`subscribeProfileEdits`) ve yeni girişte hesaptaki profili buraya uygular (`applyRemoteProfile`).
 */
const KEY = "sezi.web.profile.v1";

let current: UserProfile | null | undefined; // undefined: henüz okunmadı
const listeners = new Set<() => void>();
const editListeners = new Set<(p: UserProfile) => void>();

function read(): UserProfile | null {
  if (current !== undefined) return current;
  try {
    const parsed = UserProfile.safeParse(JSON.parse(localStorage.getItem(KEY) ?? "null"));
    current = parsed.success ? parsed.data : null;
  } catch {
    current = null; // bozuk kayıt yok sayılır
  }
  return current;
}

function write(p: UserProfile) {
  current = p;
  localStorage.setItem(KEY, JSON.stringify(p));
  listeners.forEach((l) => l());
}

/** Kullanıcının yaptığı değişiklik: yerelde saklanır ve hesaba gönderilmek üzere bildirilir. */
export function saveProfile(p: UserProfile) {
  write(p);
  editListeners.forEach((l) => l(p));
}

/** Hesaptan gelen profil: yalnız yerele yazılır (yeniden gönderilmez). */
export function applyRemoteProfile(p: UserProfile) {
  write(p);
}

export function subscribeProfileEdits(l: (p: UserProfile) => void): () => void {
  editListeners.add(l);
  return () => editListeners.delete(l);
}

/** O anki yerel profil (React dışı kod için). */
export const localProfile = (): UserProfile | null => (typeof window === "undefined" ? null : read());

function subscribe(l: () => void) {
  listeners.add(l);
  const onStorage = (e: StorageEvent) => {
    if (e.key !== KEY) return;
    current = undefined;
    l();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(l);
    window.removeEventListener("storage", onStorage);
  };
}

/** Kayıtlı profil; sunucu çiziminde ve kayıt yoksa `null`. */
export function useProfile(): UserProfile | null {
  return useSyncExternalStore(subscribe, read, () => null);
}

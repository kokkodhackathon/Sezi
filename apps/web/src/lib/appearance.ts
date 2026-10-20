"use client";

import { useSyncExternalStore } from "react";

import { CONTRAST_KEY_NAME as CONTRAST_KEY, TEXT_KEY_NAME as TEXT_KEY } from "./appearance-keys";

/**
 * Görünüm: yüksek kontrast ve yazı boyutu. Tercih bu tarayıcıda saklanır ve `<html>` öğesine
 * `data-contrast` / `data-text` olarak yazılır; ilk boyamadan önce `APPEARANCE_SCRIPT` uygular (yanıp sönme olmaz).
 */
export const TEXT_SIZES = ["normal", "lg", "xl"] as const;
export type TextSize = (typeof TEXT_SIZES)[number];

export interface Appearance {
  contrast: boolean;
  text: TextSize;
}

const isTextSize = (v: string | null): v is TextSize => v === "normal" || v === "lg" || v === "xl";

let current: Appearance | null = null;
const listeners = new Set<() => void>();

function read(): Appearance {
  if (current) return current;
  const text = localStorage.getItem(TEXT_KEY);
  current = { contrast: localStorage.getItem(CONTRAST_KEY) === "high", text: isTextSize(text) ? text : "normal" };
  return current;
}

const SERVER: Appearance = { contrast: false, text: "normal" };

export function setAppearance(patch: Partial<Appearance>) {
  const next = { ...read(), ...patch };
  current = next;
  const root = document.documentElement;
  if (next.contrast) {
    localStorage.setItem(CONTRAST_KEY, "high");
    root.dataset.contrast = "high";
  } else {
    localStorage.removeItem(CONTRAST_KEY);
    delete root.dataset.contrast;
  }
  localStorage.setItem(TEXT_KEY, next.text);
  if (next.text === "normal") delete root.dataset.text;
  else root.dataset.text = next.text;
  listeners.forEach((l) => l());
}

export function useAppearance(): Appearance {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    read,
    () => SERVER,
  );
}

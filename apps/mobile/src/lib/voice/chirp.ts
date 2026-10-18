import { Directory, File, Paths } from 'expo-file-system';
import Storage from 'expo-sqlite/kv-store';
import { z } from 'zod';

import { supabase } from '../supabase';
import { BUNDLED, BUNDLED_VOICE } from './bundled';
import type { ClipSource } from './clip-player';
import { CHIRP_VOICE } from './voice-name';

/**
 * Türkçe metin için Google Chirp 3 HD seslendirmesi (edge function `tts`).
 * Sabit yönlendirme cümleleri uygulamaya gömülü (`bundled.ts`, `scripts/gen-voice-bundle.mts`).
 * Diğerleri sunucuda bir kez üretilir, cihazda da kalıcı dosya olarak tutulur: daha önce çalınan metin internetsiz çalar.
 * Ses sabittir; değişirse sunucu önbellek yolu da (ses adıyla) ayrılır.
 */

/** Google sınırı 5000 bayt; daha uzun metin cihaz sesiyle okunur. */
const MAX_BYTES = 4500;
const KEY = 'sezi.tts.v1';

const norm = (t: string) => t.normalize('NFC').replace(/\s+/g, ' ').trim();
const enc = new TextEncoder();

// İnternetsiz kullanımda OS temizlemesin diye cache değil document.
const dir = () => new Directory(Paths.document, 'tts');
const fileFor = (key: string) => new File(dir(), `${key}.mp3`);

const Reply = z.object({ url: z.string().url(), key: z.string().regex(/^[0-9a-f]{64}$/) });

/** Normalleştirilmiş metin → dosya anahtarı (SHA-256). */
let index: Record<string, string> = {};
try {
  const parsed = z.record(z.string(), z.string()).safeParse(JSON.parse(Storage.getItemSync(KEY) ?? '{}'));
  if (parsed.success) index = parsed.data;
} catch {
  // Bozuk indeks yok sayılır; dosyalar yeniden istenir (sunucu önbelleğinden gelir).
}

const inflight = new Map<string, Promise<string>>();

const bundled = (BUNDLED_VOICE as string) === CHIRP_VOICE ? BUNDLED : {};

/** Hemen çalınabilecek Chirp sesi: uygulamaya gömülü ya da cihazda indirilmiş; yoksa null. */
export function readyChirp(text: string): ClipSource | null {
  const t = norm(text);
  const asset = bundled[t];
  if (asset !== undefined) return asset;
  const key = index[t];
  if (!key) return null;
  const file = fileFor(key);
  return file.exists ? file.uri : null;
}

/** Metnin Chirp dosyasını üretir/indirir ve yerel URI döner. İnternet yok, bütçe dolu ya da hata: reject. */
export function fetchChirp(text: string): Promise<string> {
  const t = norm(text);
  if (!t || enc.encode(t).length > MAX_BYTES) return Promise.reject(new Error('tts: metin uygun değil'));
  const running = inflight.get(t);
  if (running) return running;
  const job = (async () => {
    const { data, error } = await supabase.functions.invoke('tts', { body: { text: t, voice: CHIRP_VOICE } });
    if (error) throw error;
    const { url, key } = Reply.parse(data);
    dir().create({ idempotent: true });
    const file = fileFor(key);
    if (!file.exists) await File.downloadFileAsync(url, file, { idempotent: true });
    index[t] = key;
    Storage.setItemSync(KEY, JSON.stringify(index));
    return file.uri;
  })().finally(() => inflight.delete(t));
  inflight.set(t, job);
  return job;
}

/** Metinleri sırayla önceden hazırlar. İlk hatada durur (internet yok, bütçe dolu): gereksiz istek yağmuru olmasın. */
export async function prefetchChirp(texts: string[]): Promise<void> {
  for (const t of new Set(texts.map(norm))) {
    if (!t || readyChirp(t) !== null) continue;
    try {
      await fetchChirp(t);
    } catch {
      return;
    }
  }
}

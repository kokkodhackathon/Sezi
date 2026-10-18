import * as Speech from 'expo-speech';

import { cachedChirp, fetchChirp } from './chirp';
import { createClipPlayer } from './clip-player';

/**
 * Konuşma kuyruğu. Rehberlikte iki kural:
 * 1. Yeni talimat, okunmakta olanı yarıda kesmez; bitmesini bekler.
 * 2. Bekleyen tek bir talimat tutulur: arada daha yenisi gelirse eskisi artık geçersizdir ve atılır.
 * Acil mesajlar (rota değişti, yol kapalı) `interrupt` ile hemen okunur.
 *
 * Ses kaynağı: Türkçe metin Chirp 3 HD ile (cihazda hazırsa hemen, değilse `waitMs` kadar beklenir);
 * gelmezse ya da çalınamazsa cihaz sesi. İngilizce her zaman cihaz sesi.
 */
/** Talimat beklemeye gelmez: Chirp bu sürede gelmezse cihaz sesi. */
export const GUIDANCE_WAIT_MS = 1500;
/** Anlatım ve örnek ses: kullanıcı zaten dinlemek için bekliyor. */
export const NARRATION_WAIT_MS = 8000;

interface Utterance {
  text: string;
  lang: 'tr' | 'en';
  rate: number;
  waitMs: number;
  /** Konuşma sonuna kadar okununca (kesilmeden) çağrılır. */
  onDone?: () => void;
}

let speaking = false;
let pending: Utterance | null = null;
/** Her konuşmaya bir kimlik: durdurulan konuşmanın geç gelen geri çağrısı kuyruğu bozmasın. */
let token = 0;
const clip = createClipPlayer();

function finish(id: number, u: Utterance) {
  if (id !== token) return;
  u.onDone?.();
  speaking = false;
  const next = pending;
  pending = null;
  if (next) speakNow(next);
}

function device(u: Utterance, id: number) {
  if (id !== token) return;
  const done = () => finish(id, u);
  Speech.speak(u.text, { language: u.lang === 'tr' ? 'tr-TR' : 'en-US', rate: u.rate, onDone: done, onStopped: done, onError: done });
}

function playClip(u: Utterance, id: number, uri: string) {
  if (id !== token) return;
  clip.play(uri, { rate: u.rate, onEnd: () => finish(id, u), onError: () => device(u, id) });
}

function speakNow(u: Utterance) {
  const id = ++token;
  speaking = true;
  if (u.lang !== 'tr') return device(u, id);
  const ready = cachedChirp(u.text);
  if (ready) return playClip(u, id, ready);
  // Zaman aşımında indirme arka planda sürer ve önbelleğe yazılır; bir sonraki sefer Chirp çalar.
  let settled = false;
  const timer = setTimeout(() => {
    if (settled) return;
    settled = true;
    device(u, id);
  }, u.waitMs);
  fetchChirp(u.text).then(
    (uri) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      playClip(u, id, uri);
    },
    () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      device(u, id);
    },
  );
}

function stopAll() {
  pending = null;
  token++;
  speaking = false;
  clip.stop();
  void Speech.stop();
}

export function say(
  text: string,
  opts: { lang: 'tr' | 'en'; rate: number; interrupt?: boolean; waitMs?: number; onDone?: () => void },
) {
  const u: Utterance = { text, lang: opts.lang, rate: opts.rate, waitMs: opts.waitMs ?? GUIDANCE_WAIT_MS, onDone: opts.onDone };
  if (opts.interrupt) {
    stopAll();
    speakNow(u);
    return;
  }
  if (speaking) pending = u;
  else speakNow(u);
}

export function silence() {
  stopAll();
}

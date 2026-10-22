import { createSpeechQueue } from '@sezi/shared';
import * as Speech from 'expo-speech';

import { fetchChirp, readyChirp } from './chirp';
import { createClipPlayer } from './clip-player';

/**
 * Konuşma kuyruğu (`createSpeechQueue`, kuralları orada). Rehberlikte yeni talimat okunanı kesmez; bekleyen tek
 * talimat tutulur; acil mesajlar (rota değişti, yol kapalı) `interrupt` ile hemen okunur.
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

const clip = createClipPlayer();

function device(u: Utterance, isCurrent: () => boolean, finish: () => void) {
  if (!isCurrent()) return;
  Speech.speak(u.text, { language: u.lang === 'tr' ? 'tr-TR' : 'en-US', rate: u.rate, onDone: finish, onStopped: finish, onError: finish });
}

const queue = createSpeechQueue<Utterance>({
  play(u, isCurrent, finish) {
    if (u.lang !== 'tr') return device(u, isCurrent, finish);
    const playClip = (source: Parameters<typeof clip.play>[0]) => {
      if (!isCurrent()) return;
      clip.play(source, { rate: u.rate, onEnd: finish, onError: () => device(u, isCurrent, finish) });
    };
    const ready = readyChirp(u.text);
    if (ready !== null) return playClip(ready);
    // Zaman aşımında indirme arka planda sürer ve önbelleğe yazılır; bir sonraki sefer Chirp çalar.
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      device(u, isCurrent, finish);
    }, u.waitMs);
    fetchChirp(u.text).then(
      (uri) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        playClip(uri);
      },
      () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        device(u, isCurrent, finish);
      },
    );
  },
  stop() {
    clip.stop();
    void Speech.stop();
  },
});

export function say(
  text: string,
  opts: { lang: 'tr' | 'en'; rate: number; interrupt?: boolean; waitMs?: number; onDone?: () => void },
) {
  queue.say({ text, lang: opts.lang, rate: opts.rate, waitMs: opts.waitMs ?? GUIDANCE_WAIT_MS, onDone: opts.onDone }, opts.interrupt);
}

export function silence() {
  queue.stop();
}

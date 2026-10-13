import * as Speech from 'expo-speech';

/**
 * Konuşma kuyruğu. Rehberlikte iki kural:
 * 1. Yeni talimat, okunmakta olanı yarıda kesmez; bitmesini bekler.
 * 2. Bekleyen tek bir talimat tutulur: arada daha yenisi gelirse eskisi artık geçersizdir ve atılır.
 * Acil mesajlar (rota değişti, yol kapalı) `interrupt` ile hemen okunur.
 */
interface Utterance {
  text: string;
  language: string;
  rate: number;
}

let speaking = false;
let pending: Utterance | null = null;
/** Her konuşmaya bir kimlik: durdurulan konuşmanın geç gelen geri çağrısı kuyruğu bozmasın. */
let token = 0;

function speakNow(u: Utterance) {
  const id = ++token;
  speaking = true;
  const done = () => {
    if (id !== token) return;
    speaking = false;
    const next = pending;
    pending = null;
    if (next) speakNow(next);
  };
  Speech.speak(u.text, { language: u.language, rate: u.rate, onDone: done, onStopped: done, onError: done });
}

export function say(text: string, opts: { lang: 'tr' | 'en'; rate: number; interrupt?: boolean }) {
  const u: Utterance = { text, language: opts.lang === 'tr' ? 'tr-TR' : 'en-US', rate: opts.rate };
  if (opts.interrupt) {
    pending = null;
    token++;
    speaking = false;
    void Speech.stop();
    speakNow(u);
    return;
  }
  if (speaking) pending = u;
  else speakNow(u);
}

export function silence() {
  pending = null;
  token++;
  speaking = false;
  void Speech.stop();
}

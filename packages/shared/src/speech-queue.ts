/**
 * Konuşma kuyruğu (cihaz sesinden bağımsız çekirdek). Kurallar:
 * 1. Yeni talimat okunmakta olanı kesmez; bitmesini bekler.
 * 2. Bekleyen tek talimat tutulur: arada daha yenisi gelirse eskisi atılır.
 * 3. `interrupt` okunanı ve bekleyeni bırakıp hemen okur.
 * 4. Bir konuşmanın `onDone`'u yeni konuşma başlatabilir (ör. eşli okumada sonraki cümle). Kuyruk durumu geri
 *    çağrıdan önce kapatılır; geri çağrı yeni bir konuşma başlattıysa bekleyen ona göre sıraya girer, araya
 *    gelen normal talimat yeni sesi kesmez.
 */
export interface QueuedUtterance {
  /** Konuşma sonuna kadar okununca (kesilmeden) çağrılır. */
  onDone?: () => void;
}

export interface SpeechEngine<U> {
  /** Sesi çalar; bitince (ya da çalınamazsa) `finish` çağrılır. `isCurrent` false ise geç kalan iş bırakılır. */
  play(u: U, isCurrent: () => boolean, finish: () => void): void;
  stop(): void;
}

export function createSpeechQueue<U extends QueuedUtterance>(engine: SpeechEngine<U>) {
  let speaking = false;
  let pending: U | null = null;
  /** Her konuşmaya bir kimlik: durdurulan konuşmanın geç gelen geri çağrısı kuyruğu bozmasın. */
  let token = 0;

  function speakNow(u: U) {
    const id = ++token;
    speaking = true;
    engine.play(u, () => id === token, () => finish(id, u));
  }

  function finish(id: number, u: U) {
    if (id !== token) return;
    speaking = false;
    u.onDone?.();
    // Geri çağrı yeni bir konuşma başlattı ya da durdurdu: bekleyen ona göre işlenir.
    if (id !== token || speaking) return;
    const next = pending;
    pending = null;
    if (next) speakNow(next);
  }

  function stop() {
    pending = null;
    token++;
    speaking = false;
    engine.stop();
  }

  return {
    say(u: U, interrupt = false) {
      if (interrupt) {
        stop();
        speakNow(u);
        return;
      }
      if (speaking) pending = u;
      else speakNow(u);
    },
    stop,
  };
}

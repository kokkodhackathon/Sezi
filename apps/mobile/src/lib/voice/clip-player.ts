import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';

/**
 * Ses dosyası oynatıcısı: her örnek aynı anda tek kayıt çalar (nokta kaydı, eser kaydı, Chirp seslendirmesi).
 * Bitince `onEnd`, çalınamazsa (dosya yok, internet yok) `onError` çağrılır; durdurmada hiçbiri çağrılmaz.
 */
export interface ClipPlayer {
  play(uri: string, cb: { rate?: number; onEnd: () => void; onError: () => void }): void;
  stop(): void;
}

let modeSet = false;

function ensureAudioMode() {
  if (modeSet) return;
  modeSet = true;
  // Sessiz modda da çalsın; başka uygulamanın sesi kısılsın (anlatım öne çıkar).
  void setAudioModeAsync({ playsInSilentMode: true, interruptionMode: 'duckOthers' }).catch(() => {});
}

export function createClipPlayer(): ClipPlayer {
  let player: AudioPlayer | null = null;
  let sub: { remove: () => void } | null = null;

  function stop() {
    const p = player;
    player = null;
    sub?.remove();
    sub = null;
    if (!p) return;
    try {
      p.pause();
      p.remove();
      // Android'de remove yalnızca kaydı siler; ExoPlayer'ı hemen serbest bırakmak için release gerekir.
      p.release();
    } catch {
      // Oynatıcı zaten serbest bırakılmış.
    }
  }

  function play(uri: string, cb: { rate?: number; onEnd: () => void; onError: () => void }) {
    stop();
    ensureAudioMode();
    let p: AudioPlayer;
    try {
      p = createAudioPlayer({ uri });
    } catch {
      cb.onError();
      return;
    }
    if (cb.rate !== undefined && cb.rate !== 1) {
      try {
        p.shouldCorrectPitch = true;
        p.setPlaybackRate(cb.rate, 'high');
      } catch {
        // Hız ayarı desteklenmiyorsa normal hızda çalar.
      }
    }
    player = p;
    const finish = (fn: () => void) => {
      if (player !== p) return;
      stop();
      fn();
    };
    sub = p.addListener('playbackStatusUpdate', (s) => {
      if (s.error) finish(cb.onError);
      else if (s.didJustFinish) finish(cb.onEnd);
    });
    try {
      p.play();
    } catch {
      finish(cb.onError);
    }
  }

  return { play, stop };
}

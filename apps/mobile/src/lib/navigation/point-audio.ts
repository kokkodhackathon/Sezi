import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';

/**
 * Nokta (anlatım / eser varışı) ses kaydı oynatıcısı: aynı anda tek kayıt çalar.
 * Bitince `onEnd`, çalınamazsa (dosya yok, internet yok) `onError` çağrılır; durdurmada hiçbiri çağrılmaz.
 */
let player: AudioPlayer | null = null;
let sub: { remove: () => void } | null = null;
let modeSet = false;

export function stopPointFile() {
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

export function playPointFile(uri: string, cb: { onEnd: () => void; onError: () => void }) {
  stopPointFile();
  if (!modeSet) {
    modeSet = true;
    // Sessiz modda da çalsın; başka uygulamanın sesi kısılsın (anlatım öne çıkar).
    void setAudioModeAsync({ playsInSilentMode: true, interruptionMode: 'duckOthers' }).catch(() => {});
  }
  let p: AudioPlayer;
  try {
    p = createAudioPlayer({ uri });
  } catch {
    cb.onError();
    return;
  }
  player = p;
  const finish = (fn: () => void) => {
    if (player !== p) return;
    stopPointFile();
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

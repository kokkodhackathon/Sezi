import { AudioContext, type AudioBuffer } from 'react-native-audio-api';

/**
 * Yürüyüş ses ipuçları (earcon): konuşmadan önce ya da yerine çalan kısa sesler. Kaynak: cuelume
 * (Daniel Belyi, MIT; lisans `assets/sounds/LICENSE-cuelume.txt`), tarayıcıda çevrimdışı üretilip WAV olarak
 * gömüldü; internetsiz çalışır. Malzeme olayın türünü söyler: hava hareketi (dönüş), cam varlığı (yer işareti,
 * anlatım), tokmak sonucu (varış, uyarı).
 *
 * Her ipucunun görsel (CueFlash, uyarı kartı) ve titreşim karşılığı oturumda ayrıca verilir (AGENTS kural 5);
 * burası yalnız sesi çalar. Duymayan profil ve kalabalık modunda oturum burayı hiç çağırmaz.
 */
const FILES = {
  /** Yürüyüş başladı: yukarı çekilen hava + hafif tokmak (cuelume `open`). */
  start: require('../../../assets/sounds/start.wav'),
  /** Yürüyüş bitirildi: aşağı kapanan hava (`close`). */
  stop: require('../../../assets/sounds/stop.wav'),
  /** Dönüş: yükselen hışırtı; dönüş yönündeki kulakta (`navigate`). */
  turn: require('../../../assets/sounds/turn.wav'),
  /** Yer işareti: tek sıcak cam nota; yer işaretinin yönünden (`ready`). */
  landmark: require('../../../assets/sounds/landmark.wav'),
  /** Rotadan çıkıldı / yol kapandı, yeni rota var: tokmakla beşli (`warning`). */
  warning: require('../../../assets/sounds/warning.wav'),
  /** Rota bulunamadı: kısık, alçak akor (`error`). */
  error: require('../../../assets/sounds/error.wav'),
  /** Anlatım noktası açıldı, yanıt bekliyor: uzun çalan yüksek cam zil (`attention`). */
  attention: require('../../../assets/sounds/attention.wav'),
  /** Esere varış (yürüyüşün sonu): güçlü tokmak akoru (`success`, strong). */
  arrive: require('../../../assets/sounds/arrive.wav'),
  /** Turda bir durağa varıldı, tur sürüyor: aynı akorun yumuşağı (`success`). */
  waypoint: require('../../../assets/sounds/waypoint.wav'),
  /** Kalabalık modu açıldı / kapandı (`toggle`, kapanırken ters). */
  crowdOn: require('../../../assets/sounds/crowd-on.wav'),
  crowdOff: require('../../../assets/sounds/crowd-off.wav'),
} as const;

export type Earcon = keyof typeof FILES;

/** cuelume çıktısı düşük düzeyde üretilir (tepe ≈ 0,12-0,22); sokakta duyulsun diye hepsi aynı oranda yükseltilir. */
const LEVEL = 2.6;

let ctx: AudioContext | null = null;
const buffers = new Map<Earcon, AudioBuffer>();
let loading: Promise<void> | null = null;
/**
 * Oturum nesli: `cancelEarcons` her çağrıda artar. Yükleme bitmeden istenen ya da gecikmeyle planlanan bir ipucu,
 * istendiği nesil geçmişse çalmaz (ör. ilk çözme sürerken kalabalık modu açıldı ya da yürüyüşten çıkıldı).
 */
let generation = 0;
/** Başlatılmış ama bitmemiş kaynaklar (gecikmeli olanlar dahil); iptalde susturulur. */
const live = new Set<{ stop: (when?: number) => void }>();

/** Bekleyen ve çalan bütün ipuçlarını iptal eder: yürüyüş durdu, duraklatıldı, kalabalık modu açıldı, varıldı. */
export function cancelEarcons() {
  generation++;
  for (const src of live) {
    try {
      src.stop();
    } catch {
      // Zaten bitmiş kaynak.
    }
  }
  live.clear();
}

function context(): AudioContext | null {
  if (ctx) return ctx;
  try {
    ctx = new AudioContext();
  } catch {
    // Ses motoru açılamazsa rehberlik konuşma, görsel ve titreşimle sürer.
    ctx = null;
  }
  return ctx;
}

/** Sesleri bir kez çözer (yürüyüş başlarken çağrılır; ilk ipucu beklemesin). Hata sessizce atlanır. */
export function preloadEarcons(): Promise<void> {
  const c = context();
  if (!c) return Promise.resolve();
  loading ??= Promise.all(
    (Object.keys(FILES) as Earcon[]).map(async (name) => {
      try {
        const buf = await c.decodeAudioData(FILES[name]);
        if (buf) buffers.set(name, buf);
      } catch {
        // Bu ses çözülemezse yalnız o ipucu susar.
      }
    }),
  ).then(() => undefined);
  return loading;
}

/**
 * İpucunu çalar. `pan` -1 (sol) … 1 (sağ): dönüş ve yer işareti yönden gelir (kulaklıkta belirgin).
 * `delayS` aynı anda iki ipucu gerektiğinde ikincisini kaydırır (dönüş + yer işareti).
 */
export function playEarcon(name: Earcon, pan = 0, delayS = 0) {
  const c = context();
  if (!c) return;
  const gen = generation;
  const run = () => {
    if (gen !== generation) return;
    const buf = buffers.get(name);
    if (!buf) return;
    try {
      const src = c.createBufferSource();
      src.buffer = buf;
      const gain = c.createGain();
      gain.gain.value = LEVEL;
      const panner = c.createStereoPanner();
      panner.pan.value = Math.max(-1, Math.min(1, pan));
      src.connect(gain);
      gain.connect(panner);
      panner.connect(c.destination);
      live.add(src);
      src.onEnded = () => live.delete(src);
      src.start(c.currentTime + delayS);
    } catch {
      // Çalınamayan ipucu atlanır; görsel ve titreşim karşılığı zaten verildi.
    }
  };
  if (buffers.has(name)) run();
  else void preloadEarcons().then(run);
}

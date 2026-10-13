import type { SoundKind, SoundVoice } from '@sezi/shared';
import { AudioContext } from 'react-native-audio-api';

/**
 * Ses manzarası motoru: `soundscapeMix` çıktısını sürekli sese çevirir.
 * Her yer işareti için bir ses: su (bant geçiren gürültü), çarşı uğultusu (alçak geçiren gürültü),
 * yer işareti tınısı (yumuşak beşli aralıklı iki sinüs). Saha kayıtları gelince kaynaklar ses dosyasıyla değişir.
 */
type Ctx = AudioContext;
type Gain = ReturnType<Ctx['createGain']>;
type Panner = ReturnType<Ctx['createStereoPanner']>;
type Source = { stop: (when?: number) => void };

interface Voice {
  gain: Gain;
  panner: Panner;
  sources: Source[];
}

/** Ses türüne göre temel düzey: ses manzarası konuşmayı bastırmamalı. */
const LEVEL: Record<SoundKind, number> = { water: 0.22, market: 0.3, chime: 0.07 };
/** Düzey değişimlerinin yumuşaklığı (s). */
const SMOOTH_S = 0.15;

let ctx: Ctx | null = null;
let master: Gain | null = null;
let noise: ReturnType<Ctx['createBuffer']> | null = null;
const voices = new Map<string, Voice>();

function ensureContext(): Ctx | null {
  if (ctx) return ctx;
  try {
    ctx = new AudioContext();
    master = ctx.createGain();
    master.gain.value = 0.9;
    master.connect(ctx.destination);
    // 2 saniyelik beyaz gürültü, döngüde çalınır.
    const length = ctx.sampleRate * 2;
    noise = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = new Float32Array(length);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    noise.copyToChannel(data, 0);
    return ctx;
  } catch {
    ctx = null;
    return null;
  }
}

function createVoice(c: Ctx, kind: SoundKind): Voice {
  const gain = c.createGain();
  gain.gain.value = 0;
  const panner = c.createStereoPanner();
  gain.connect(panner);
  panner.connect(master!);
  const level = c.createGain();
  level.gain.value = LEVEL[kind];
  level.connect(gain);
  const sources: Source[] = [];

  if (kind === 'chime') {
    for (const freq of [220, 330]) {
      const osc = c.createOscillator();
      osc.frequency.value = freq;
      osc.connect(level);
      osc.start();
      sources.push(osc);
    }
  } else {
    const src = c.createBufferSource();
    src.buffer = noise;
    src.loop = true;
    const filter = c.createBiquadFilter();
    filter.type = kind === 'water' ? 'bandpass' : 'lowpass';
    filter.frequency.value = kind === 'water' ? 1400 : 420;
    filter.Q.value = kind === 'water' ? 0.7 : 0.5;
    src.connect(filter);
    filter.connect(level);
    src.start();
    sources.push(src);
  }
  return { gain, panner, sources };
}

function release(id: string, v: Voice) {
  if (!ctx) return;
  const now = ctx.currentTime;
  v.gain.gain.setTargetAtTime(0, now, SMOOTH_S);
  for (const s of v.sources) s.stop(now + 0.6);
  voices.delete(id);
}

/** Duyulan sesleri günceller: yeni sesler yumuşakça girer, menzilden çıkanlar söner. */
export function updateSoundscape(mix: SoundVoice[]) {
  const c = ensureContext();
  if (!c) return;
  const now = c.currentTime;
  const ids = new Set(mix.map((v) => v.id));
  for (const [id, v] of voices) if (!ids.has(id)) release(id, v);
  for (const m of mix) {
    let v = voices.get(m.id);
    if (!v) {
      v = createVoice(c, m.kind);
      voices.set(m.id, v);
    }
    v.gain.gain.setTargetAtTime(m.gain, now, SMOOTH_S);
    v.panner.pan.setTargetAtTime(Math.max(-1, Math.min(1, m.pan)), now, SMOOTH_S);
  }
}

/** Ses manzarasını tamamen susturur (duraklatma, varış, ekrandan çıkış, kalabalık modu). */
export function stopSoundscape() {
  for (const [id, v] of voices) release(id, v);
  const c = ctx;
  ctx = null;
  master = null;
  noise = null;
  if (c) setTimeout(() => void c.close(), 800);
}

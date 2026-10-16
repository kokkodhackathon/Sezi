import { distanceM } from "./geo";
import type { LngLat, LocalizedText } from "./schemas";
import type { LocationFix } from "./tracking";

/**
 * Anlatım noktası: yürüyüşte kullanıcı yarıçapa girince açılan metin ve ses.
 * Yalnızca yayındaki (`verified`) noktalar istemciye gelir; bunlarda metin zorunludur (DB check),
 * böylece her sesin yazılı karşılığı olur.
 */
export interface StoryPoint {
  id: string;
  citySlug: string;
  title: LocalizedText;
  body: LocalizedText;
  location: LngLat;
  radiusM: number;
  /** `audio` bucket'ı içindeki storage_path. */
  audio: { tr?: string; en?: string };
}

/** Ölçüm bundan kötüyse (m) tetikleme yapılmaz: sıçrayan GPS yanlış pop-up açmasın. */
export const STORY_MAX_ACCURACY_M = 50;

/** Yarıçapın içine giren ve bu yürüyüşte henüz açılmamış noktalar, yakından uzağa. */
export function dueStoryPoints(
  points: readonly StoryPoint[],
  fix: LocationFix,
  fired: ReadonlySet<string>,
): StoryPoint[] {
  if (fix.accuracyM > STORY_MAX_ACCURACY_M) return [];
  return points
    .filter((p) => !fired.has(p.id))
    .map((p) => ({ p, d: distanceM(fix.position, p.location) }))
    .filter(({ p, d }) => d <= p.radiusM)
    .sort((a, b) => a.d - b.d)
    .map(({ p }) => p);
}

export type StoryVoice =
  | { kind: "file"; path: string; lang: "tr" | "en" }
  | { kind: "tts"; text: string; lang: "tr" | "en" };

/** Çalınacak ses: kullanıcının dilinde kayıt → kendi dilinde metin (TTS) → TR kayıt → TR metin (TTS). */
export function storyVoice(p: StoryPoint, lang: "tr" | "en"): StoryVoice {
  if (lang === "en") {
    if (p.audio.en) return { kind: "file", path: p.audio.en, lang: "en" };
    if (p.body.en) return { kind: "tts", text: p.body.en, lang: "en" };
  }
  if (p.audio.tr) return { kind: "file", path: p.audio.tr, lang: "tr" };
  return { kind: "tts", text: p.body.tr, lang: "tr" };
}

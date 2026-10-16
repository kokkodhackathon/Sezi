import { distanceM } from "./geo";
import type { LngLat, LocalizedText } from "./schemas";
import type { LocationFix } from "./tracking";

/**
 * Nokta: rotaların kullandığı her yer admin panelinden girilir (nav_points). Bir yer birden çok rol taşıyabilir.
 *   start     başlangıç / buluşma noktası
 *   landmark  yer işareti: talimatlarda anılır, görünen yol tercih edilir
 *   story     anlatım: yarıçapa girilince metin ve ses açılır, rota yakındakilere uğrar
 *   arrival   eser varış bilgisi: esere varınca açılan metin ve ses
 * Yalnızca yayındaki (`verified`) noktalar istemciye gelir; anlatım ve varışta metin zorunludur (DB check),
 * böylece her sesin yazılı karşılığı olur.
 */
export type PointRole = "start" | "landmark" | "story" | "arrival";
export type Ambient = "water" | "market" | "chime";

export interface NavPoint {
  id: string;
  citySlug: string;
  roles: PointRole[];
  title: LocalizedText;
  /** Anlatım ve varış metni (diğer rollerde boş olabilir). */
  body?: LocalizedText;
  location: LngLat;
  radiusM: number;
  /** Varış bilgisinin bağlı olduğu eser. */
  workSlug?: string;
  /** Yer işaretinin uzaktan görünürlüğü (1–3). */
  salience?: number;
  ambient?: Ambient;
  /** Başlangıç listesindeki sıra (küçük önce). */
  sortOrder: number;
  /** `audio` bucket'ı içindeki storage_path. */
  audio: { tr?: string; en?: string };
}

/** Kullanıcı yaklaşınca açılan (metni olan) nokta: anlatım ya da eser varışı. */
export const opensOnApproach = (p: NavPoint): p is NavPoint & { body: LocalizedText } =>
  !!p.body && (p.roles.includes("story") || p.roles.includes("arrival"));

/** Ölçüm bundan kötüyse (m) tetikleme yapılmaz: sıçrayan GPS yanlış pop-up açmasın. */
export const POINT_MAX_ACCURACY_M = 50;

/** Yarıçapın içine giren ve bu yürüyüşte henüz açılmamış (metinli) noktalar, yakından uzağa. */
export function duePoints(points: readonly NavPoint[], fix: LocationFix, fired: ReadonlySet<string>): NavPoint[] {
  if (fix.accuracyM > POINT_MAX_ACCURACY_M) return [];
  return points
    .filter((p) => opensOnApproach(p) && !fired.has(p.id))
    .map((p) => ({ p, d: distanceM(fix.position, p.location) }))
    .filter(({ p, d }) => d <= p.radiusM)
    .sort((a, b) => a.d - b.d)
    .map(({ p }) => p);
}

export type PointVoice =
  | { kind: "file"; path: string; lang: "tr" | "en" }
  | { kind: "tts"; text: string; lang: "tr" | "en" };

/**
 * Çalınacak ses: kullanıcının dilinde kayıt → kendi dilinde metin (TTS) → TR kayıt → TR metin (TTS).
 * Metni olmayan noktada (yalnız başlangıç/yer işareti) ses yoktur.
 */
export function pointVoice(p: NavPoint, lang: "tr" | "en"): PointVoice | null {
  if (lang === "en") {
    if (p.audio.en) return { kind: "file", path: p.audio.en, lang: "en" };
    if (p.body?.en) return { kind: "tts", text: p.body.en, lang: "en" };
  }
  if (p.audio.tr) return { kind: "file", path: p.audio.tr, lang: "tr" };
  return p.body ? { kind: "tts", text: p.body.tr, lang: "tr" } : null;
}

/** Başlangıç noktaları, listedeki sırayla (ilk olan varsayılan). */
export const startPointsOf = (points: readonly NavPoint[]) =>
  points.filter((p) => p.roles.includes("start")).sort((a, b) => a.sortOrder - b.sortOrder || a.title.tr.localeCompare(b.title.tr, "tr"));

/** Esere bağlı yayındaki varış bilgisi. */
export const arrivalFor = (points: readonly NavPoint[], workSlug: string) =>
  points.find((p) => p.roles.includes("arrival") && p.workSlug === workSlug);

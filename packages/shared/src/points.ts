import { z } from "zod";

import { distanceM } from "./geo";
import { LocalizedText, type LngLat } from "./schemas";
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

export const NAV_POINT_COLUMNS = "id, city_slug, roles, title, body, lng, lat, radius_m, work_slug, salience, ambient, sort_order, audio_tr, audio_en";

export const NavPointRow = z.object({
  id: z.string(),
  city_slug: z.string(),
  roles: z.array(z.enum(["start", "landmark", "story", "arrival"])).min(1),
  title: LocalizedText,
  body: LocalizedText.nullable(),
  lng: z.number(),
  lat: z.number(),
  radius_m: z.number(),
  work_slug: z.string().nullable(),
  salience: z.number().nullable(),
  ambient: z.enum(["water", "market", "chime"]).nullable(),
  sort_order: z.number(),
  audio_tr: z.string().nullable(),
  audio_en: z.string().nullable(),
});
export type NavPointRow = z.infer<typeof NavPointRow>;

export function toNavPoints(rows: unknown[]): NavPoint[] {
  return rows.flatMap((r) => {
    const p = NavPointRow.safeParse(r);
    if (!p.success) return [];
    const d = p.data;
    return [
      {
        id: d.id,
        citySlug: d.city_slug,
        roles: d.roles,
        title: d.title,
        body: d.body ?? undefined,
        location: [d.lng, d.lat],
        radiusM: d.radius_m,
        workSlug: d.work_slug ?? undefined,
        salience: d.salience ?? undefined,
        ambient: d.ambient ?? undefined,
        sortOrder: d.sort_order,
        audio: { tr: d.audio_tr ?? undefined, en: d.audio_en ?? undefined },
      },
    ];
  });
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

// ---------- Eser metninden anlatım ----------

/** Esere bağlı sanal anlatım noktasının kimlik öneki (`work:<slug>`). */
export const WORK_POINT_PREFIX = "work:";
/** Eserin yanından geçerken kartın açıldığı uzaklık (m). */
export const WORK_POINT_RADIUS_M = 20;
/** Kısa anlatımın üst sınırı (karakter): yürürken bir bakışta okunur, yaklaşık yarım dakikada dinlenir. */
export const EXCERPT_MAX = 420;

export const isWorkPoint = (p: NavPoint) => p.id.startsWith(WORK_POINT_PREFIX);

/** Cümle sonu: nokta/ünlem/soru, ardından boşluk ve büyük harf. "II. Murad", "15. yüzyıl" gibi sıra sayıları sayılmaz. */
const SENTENCE_END = /(?<![\dIVXLC])[.!?]["”’)]?(?=\s+["“‘(]?[A-ZÇĞİÖŞÜÂÎÛ])/gu;

/**
 * Eser metninden kısa anlatım: baştan paragraflar (en az ~160 karakter olana dek), uzunsa son tam cümlede kesilir.
 * Metin değiştirilmez, yalnız kısaltılır; tam metin eser sayfasındadır.
 */
export function excerpt(text: string, max = EXCERPT_MAX): string {
  const paras = text.trim().split(/\n\s*\n/).map((p) => p.replace(/\s+/g, " ").trim()).filter(Boolean);
  let out = "";
  for (const p of paras) {
    out = out ? `${out} ${p}` : p;
    if (out.length >= 160) break;
  }
  if (out.length <= max) return out;
  const head = out.slice(0, max);
  let end = -1;
  for (const m of head.matchAll(SENTENCE_END)) end = m.index + m[0].length;
  if (end >= max * 0.3) return head.slice(0, end);
  return `${head.slice(0, head.lastIndexOf(" ")).replace(/[,;:]$/, "")}…`;
}

/** Rota tarafının ihtiyaç duyduğu eser bilgisi: yayındaki metni ve kesin konumu olan eser. */
export interface WorkText {
  slug: string;
  citySlug: string;
  name: LocalizedText;
  location: LngLat;
  /** Yayınlanmış özet ya da tarihçe. */
  text: LocalizedText;
}

/** Eserin sanal anlatım noktası: yanından geçilince ve (admin'de varış bilgisi yoksa) varışta açılır. */
export function workPoint(w: WorkText): NavPoint {
  const en = w.text.en ? excerpt(w.text.en) : undefined;
  return {
    id: WORK_POINT_PREFIX + w.slug,
    citySlug: w.citySlug,
    roles: ["story"],
    title: w.name,
    body: { tr: excerpt(w.text.tr), ...(en ? { en } : {}) },
    location: w.location,
    radiusM: WORK_POINT_RADIUS_M,
    workSlug: w.slug,
    sortOrder: 0,
    audio: {},
  };
}

/**
 * Yanından geçerken açılabilecek eser noktaları. Admin'de esere bağlı anlatım ya da varış noktası varsa
 * o kullanılır (aynı eser iki kez açılmaz); hedef ve turdaki eserler varışta açılır, yolda değil.
 */
export function passingWorkPoints(workPoints: readonly NavPoint[], navPoints: readonly NavPoint[], exclude: ReadonlySet<string>): NavPoint[] {
  const covered = new Set(navPoints.flatMap((p) => (p.workSlug && opensOnApproach(p) ? [p.workSlug] : [])));
  return workPoints.filter((p) => p.workSlug && !covered.has(p.workSlug) && !exclude.has(p.workSlug));
}

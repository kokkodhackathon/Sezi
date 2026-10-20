import { z } from "zod";

/** Çok dilli metin. Türkçe zorunlu, İngilizce opsiyonel (çeviri admin onayıyla gelir). */
export const LocalizedText = z.object({
  tr: z.string().trim().min(1),
  en: z.string().trim().min(1).optional(),
});
export type LocalizedText = z.infer<typeof LocalizedText>;

export const ContentStatus = z.enum(["draft", "verified", "archived"]);
export type ContentStatus = z.infer<typeof ContentStatus>;

export const LngLat = z.tuple([
  z.number().min(-180).max(180),
  z.number().min(-90).max(90),
]);
export type LngLat = z.infer<typeof LngLat>;

export const Source = z.object({
  id: z.string().uuid(),
  title: z.string().trim().min(1),
  author: z.string().trim().optional(),
  publisher: z.string().trim().optional(),
  year: z.number().int().min(1000).max(2100).optional(),
  url: z.string().url().optional(),
});
export type Source = z.infer<typeof Source>;

export const Media = z.object({
  id: z.string().uuid(),
  url: z.string().url(),
  altText: LocalizedText,
  credit: z.string().trim().optional(),
});
export type Media = z.infer<typeof Media>;

export const Work = z.object({
  id: z.string().uuid(),
  slug: z.string().regex(/^[a-z0-9-]+$/),
  name: LocalizedText,
  summary: LocalizedText.optional(),
  history: LocalizedText.optional(),
  workTypeId: z.string().uuid(),
  cityId: z.string().uuid(),
  complexId: z.string().uuid().nullable(),
  location: LngLat,
  builtYear: z.number().int().optional(),
  founder: z.string().trim().optional(),
  a11yScore: z.number().min(0).max(100).nullable(),
  status: ContentStatus,
});
export type Work = z.infer<typeof Work>;

// --- Navigasyon (Lynch grafiği) ---

export const LynchType = z.enum(["landmark", "node", "district_gate"]);
export type LynchType = z.infer<typeof LynchType>;

export const NavNode = z.object({
  id: z.string(),
  lynchType: LynchType,
  name: LocalizedText.optional(),
  location: LngLat,
  /** Landmark'ın görülebildiği açı (derece, 0–360). */
  visibilityDeg: z.number().min(0).max(360).optional(),
  soundAssetId: z.string().optional(),
  workId: z.string().uuid().optional(),
});
export type NavNode = z.infer<typeof NavNode>;

export const Surface = z.enum(["asphalt", "paving", "cobble", "gravel", "marble"]);
export type Surface = z.infer<typeof Surface>;

export const NavSegment = z.object({
  id: z.string(),
  from: z.string(),
  to: z.string(),
  lengthM: z.number().positive(),
  steps: z.number().int().min(0).default(0),
  /** Mutlak eğim yüzdesi. */
  slopePct: z.number().min(0).default(0),
  surface: Surface.default("paving"),
  widthCm: z.number().positive().optional(),
  kerb: z.boolean().default(false),
  /** 0 (sessiz) – 1 (çok gürültülü). Görme engelli için ses ipuçlarını bastırır. */
  noise: z.number().min(0).max(1).default(0),
  /** 0–1: segment boyunca landmark görünürlüğü. */
  landmarkVisibility: z.number().min(0).max(1).default(0),
  /** Onaylı erişilebilirlik bildirimiyle geçici kapatıldı. */
  blocked: z.boolean().default(false),
  /** from → to yönünde çizgi geometrisi; yoksa iki uç arası düz kabul edilir. */
  geometry: z.array(LngLat).optional(),
  /** Sokak adı (OSM): Lynch "yol" öğesi, yönlendirmede anılır ("Uzunçarşı boyunca"). */
  name: z.string().optional(),
});
export type NavSegment = z.infer<typeof NavSegment>;
export type NavSegmentInput = z.input<typeof NavSegment>;

export const CueType = z.enum(["sound", "visual", "tactile", "generic"]);
export type CueType = z.infer<typeof CueType>;

export const Instruction = z.object({
  id: z.string(),
  nodeId: z.string(),
  /** Bu talimat hangi node'dan gelinirken geçerli; yoksa her yönden. */
  approachFrom: z.string().optional(),
  text: LocalizedText,
  cueType: CueType,
  status: ContentStatus,
});
export type Instruction = z.infer<typeof Instruction>;

// --- Kullanıcı profili ---

export const UserProfile = z.object({
  vision: z.enum(["full", "low", "blind"]),
  mobility: z.enum(["none", "cane", "wheelchair"]),
  /** İşitme: duymayan kullanıcıda ses ipuçları görsel + titreşim karşılığına çevrilir. Eski profiller için varsayılan "full". */
  hearing: z.enum(["full", "hard", "deaf"]).default("full"),
  senses: z.object({
    audio: z.boolean(),
    haptic: z.boolean(),
    visual: z.boolean(),
  }),
  lang: z.enum(["tr", "en"]),
});
export type UserProfile = z.infer<typeof UserProfile>;

/** Görme profiline göre önerilen duyu kanalları; kullanıcı onboarding'de değiştirebilir. */
export function defaultSenses(vision: UserProfile["vision"], hearing: UserProfile["hearing"] = "full"): UserProfile["senses"] {
  if (hearing === "deaf") return { audio: false, haptic: true, visual: vision !== "blind" };
  if (vision === "blind") return { audio: true, haptic: true, visual: false };
  if (vision === "low") return { audio: true, haptic: true, visual: true };
  return { audio: true, haptic: false, visual: true };
}

// --- Topluluk: erişilebilirlik bildirimi ---

export const A11yReportType = z.enum([
  "stairs",
  "ramp_blocked",
  "narrow_path",
  "surface_damage",
  "construction",
  "other",
]);

export const A11yReportInput = z.object({
  segmentId: z.string(),
  type: A11yReportType,
  note: z.string().trim().max(500).optional(),
});
export type A11yReportInput = z.infer<typeof A11yReportInput>;

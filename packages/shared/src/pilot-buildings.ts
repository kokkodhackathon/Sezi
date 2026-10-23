import { z } from "zod";

/**
 * Pilot alan binaları (`data/build_buildings.py` üretir, `apps/mobile/assets/pilot/*-buildings.json`):
 * Lynch bölgesi (pilot alan çokgeni) ve yer işareti binaları. Mobil ve web haritası aynı dosyayı çizer.
 * Bina özellikleri: `w` eser slug'ı, `t` eser türü, `h` blok yüksekliği (m), `b` taban yüksekliği (m).
 */
const Ring = z.array(z.tuple([z.number(), z.number()]));

export const PilotBuildingsSchema = z.object({
  district: z.object({ polygon: z.array(Ring) }).nullable(),
  landmarks: z.object({
    type: z.literal("FeatureCollection"),
    features: z.array(
      z.object({
        type: z.literal("Feature"),
        properties: z.object({ w: z.string(), t: z.string(), h: z.number(), b: z.number() }),
        geometry: z.object({ type: z.literal("Polygon"), coordinates: z.array(Ring) }),
      }),
    ),
  }),
});
export type PilotBuildings = z.infer<typeof PilotBuildingsSchema>;

/** Yer işareti bloğu yarı saydam (altındaki Mapbox binası seçilsin); eğik bakış açısı (derece). */
export const LANDMARK_OPACITY = 0.6;
export const MAP_PITCH = 45;
/** Bloklar bu yakınlıktan itibaren yükselir (14'te düz, 15,2'de tam yükseklik). */
export const LANDMARK_MIN_ZOOM = 14;
export const LANDMARK_FULL_ZOOM = 15.2;

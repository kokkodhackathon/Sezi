/**
 * Eser türü glifleri (24×24 görünüm kutusu). Renk tek başına anlam taşımaz: her türün kendi silueti var.
 * Mobil (react-native-svg) ve web haritası (SVG → harita simgesi) aynı çizimi kullanır.
 */
export type GlyphPart =
  | { kind: "path"; d: string; evenOdd?: boolean; /** Dolgu yerine çizgi (kalınlık). */ stroke?: number }
  | { kind: "rect"; x: number; y: number; w: number; h: number; /** Merkez çevresinde döndürme (derece). */ rotate?: number }
  | { kind: "circle"; cx: number; cy: number; r: number; /** Glif renginde değil, yarı saydam koyu gölge. */ shade?: boolean };

const ground = (x: number, y: number, w: number, h = 1.6): GlyphPart => ({ kind: "rect", x, y, w, h });

const FALLBACK: GlyphPart[] = [
  { kind: "rect", x: 6, y: 6, w: 12, h: 12 },
  { kind: "rect", x: 6, y: 6, w: 12, h: 12, rotate: 45 },
  { kind: "circle", cx: 12, cy: 12, r: 2.4, shade: true },
];

export const GLYPHS: Record<string, GlyphPart[]> = {
  cami: [
    { kind: "path", d: "M5 20 V14 A7 7 0 0 1 19 14 V20 Z" },
    { kind: "rect", x: 11.3, y: 4, w: 1.4, h: 3 },
    { kind: "rect", x: 20, y: 5, w: 1.8, h: 15 },
    { kind: "path", d: "M20 5 L20.9 2.5 L21.8 5 Z" },
    ground(3, 20, 20),
  ],
  medrese: [
    { kind: "path", d: "M3 20 V11 A3 3 0 0 1 9 11 V20 H7.6 V11.6 A1.6 1.6 0 0 0 4.4 11.6 V20 Z" },
    { kind: "path", d: "M9 20 V11 A3 3 0 0 1 15 11 V20 H13.6 V11.6 A1.6 1.6 0 0 0 10.4 11.6 V20 Z" },
    { kind: "path", d: "M15 20 V11 A3 3 0 0 1 21 11 V20 H19.6 V11.6 A1.6 1.6 0 0 0 16.4 11.6 V20 Z" },
    ground(2, 20, 20),
    ground(2, 6.5, 20, 1.4),
  ],
  turbe: [{ kind: "path", d: "M12 2.5 L17 10 H7 Z" }, { kind: "path", d: "M6.5 11 H17.5 L19 13 V20 H5 V13 Z" }, ground(3.5, 20, 17)],
  cesme: [
    { kind: "path", d: "M4 21 V9 A8 6 0 0 1 20 9 V21 H17.5 V9.8 A5.5 4 0 0 0 6.5 9.8 V21 Z" },
    { kind: "path", d: "M12 11 C12 11 9.5 14.2 9.5 15.8 A2.5 2.5 0 0 0 14.5 15.8 C14.5 14.2 12 11 12 11 Z" },
  ],
  sebil: [
    { kind: "path", d: "M3.5 21 V10 A8.5 7 0 0 1 20.5 10 V21 Z M6 19 H18 V10.6 A6 4.8 0 0 0 6 10.6 Z", evenOdd: true },
    { kind: "rect", x: 8.4, y: 9, w: 1.3, h: 10 },
    { kind: "rect", x: 11.35, y: 7.8, w: 1.3, h: 11.2 },
    { kind: "rect", x: 14.3, y: 9, w: 1.3, h: 10 },
  ],
  hamam: [
    { kind: "path", d: "M3 19 V15 A4.5 4.5 0 0 1 12 15 V19 Z M12 19 V15 A4.5 4.5 0 0 1 21 15 V19 Z" },
    { kind: "path", d: "M7 10.5 A5 5 0 0 1 17 10.5 Z" },
    ground(2, 19, 20, 2),
  ],
  imaret: [
    { kind: "path", d: "M4 11 H20 V12.5 A8 7 0 0 1 4 12.5 Z" },
    ground(2.5, 10, 19),
    { kind: "path", d: "M8.5 3 C7.5 4.5 9.5 5.5 8.5 8 M12 3 C11 4.5 13 5.5 12 8 M15.5 3 C14.5 4.5 16.5 5.5 15.5 8", stroke: 1.3 },
    { kind: "rect", x: 9, y: 19, w: 6, h: 2 },
  ],
  kutuphane: [
    { kind: "path", d: "M2.5 6 C6 4.6 9 4.8 11.3 6.4 V19.5 C9 18 6 17.8 2.5 19.2 Z" },
    { kind: "path", d: "M21.5 6 C18 4.6 15 4.8 12.7 6.4 V19.5 C15 18 18 17.8 21.5 19.2 Z" },
  ],
  // Avlulu kâgir yapı ve kemerli kapı (han, kervansaray).
  han: [{ kind: "path", d: "M3 21 V5 H21 V21 H14.2 V17.2 A2.2 2.2 0 0 0 9.8 17.2 V21 Z M7.2 8.6 H16.8 V13.6 H7.2 Z", evenOdd: true }, ground(2, 3.4, 20)],
  // Sıra kubbeli örtülü çarşı (bedesten, arasta).
  carsi: [
    { kind: "path", d: "M3.2 13 A2.9 2.9 0 0 1 9 13 Z M9.1 13 A2.9 2.9 0 0 1 14.9 13 Z M15 13 A2.9 2.9 0 0 1 20.8 13 Z" },
    { kind: "path", d: "M3 14 H21 V20 H16.6 V17 A1.6 1.6 0 0 0 13.4 17 V20 H10.6 V17 A1.6 1.6 0 0 0 7.4 17 V20 H3 Z" },
    ground(2, 20, 20),
  ],
};

/** Türün glifi; tanımsız türde ortak karo glifi. */
export const glyphFor = (slug: string): GlyphPart[] => GLYPHS[slug] ?? FALLBACK;

/** Simgesi olan eser türleri (haritada her biri için bir resim üretilir); diğerleri `diger` simgesini kullanır. */
export const GLYPH_TYPES = [...Object.keys(GLYPHS), "diger"];
export const glyphType = (slug: string) => (slug in GLYPHS ? slug : "diger");

/** Glifin SVG gövdesi (`<svg viewBox="0 0 24 24">` içine). */
export function glyphSvgBody(slug: string, color: string): string {
  return glyphFor(slug)
    .map((p) => {
      if (p.kind === "path") {
        return p.stroke
          ? `<path d="${p.d}" fill="none" stroke="${color}" stroke-width="${p.stroke}" stroke-linecap="round"/>`
          : `<path d="${p.d}" fill="${color}"${p.evenOdd ? ' fill-rule="evenodd"' : ""}/>`;
      }
      if (p.kind === "rect") {
        const rot = p.rotate ? ` transform="rotate(${p.rotate} ${p.x + p.w / 2} ${p.y + p.h / 2})"` : "";
        return `<rect x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" fill="${color}"${rot}/>`;
      }
      return `<circle cx="${p.cx}" cy="${p.cy}" r="${p.r}" fill="${p.shade ? "#000" : color}"${p.shade ? ' fill-opacity="0.33"' : ""}/>`;
    })
    .join("");
}

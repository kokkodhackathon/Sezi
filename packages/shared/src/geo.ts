import type { LngLat } from "./schemas";

const R = 6_371_000;
const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

/** İki nokta arası mesafe (metre). */
export function distanceM(a: LngLat, b: LngLat): number {
  const dLat = rad(b[1] - a[1]);
  const dLng = rad(b[0] - a[0]);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** a'dan b'ye pusula yönü (0 = kuzey, saat yönünde, 0–360). */
export function bearingDeg(a: LngLat, b: LngLat): number {
  const y = Math.sin(rad(b[0] - a[0])) * Math.cos(rad(b[1]));
  const x =
    Math.cos(rad(a[1])) * Math.sin(rad(b[1])) -
    Math.sin(rad(a[1])) * Math.cos(rad(b[1])) * Math.cos(rad(b[0] - a[0]));
  return (deg(Math.atan2(y, x)) + 360) % 360;
}

/** Kullanıcının baktığı yöne göre hedefin göreli açısı (-180..180, + = sağ). */
export function relativeBearing(heading: number, target: number): number {
  return ((target - heading + 540) % 360) - 180;
}

/** Stereo panlama değeri (-1 sol, +1 sağ). Arkadaki sesler hafif kısılmaz, sadece yanlara yatar. */
export function stereoPan(heading: number, target: number): number {
  return Math.sin(rad(relativeBearing(heading, target)));
}

/** Polyline üzerinde baştan `d` metre ilerideki nokta (simülasyon modu için). */
export function pointAlong(line: LngLat[], d: number): LngLat {
  if (line.length === 0) throw new Error("boş polyline");
  let remaining = Math.max(0, d);
  for (let i = 0; i < line.length - 1; i++) {
    const a = line[i]!;
    const b = line[i + 1]!;
    const seg = distanceM(a, b);
    if (remaining <= seg) {
      const t = seg === 0 ? 0 : remaining / seg;
      return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    }
    remaining -= seg;
  }
  return line[line.length - 1]!;
}

export function polylineLength(line: LngLat[]): number {
  let total = 0;
  for (let i = 0; i < line.length - 1; i++) total += distanceM(line[i]!, line[i + 1]!);
  return total;
}

/**
 * Noktanın polyline'a en kısa mesafesi (metre): her segmente dik izdüşümle, segment dışına düşerse en yakın uca.
 * Kısa mesafeler için noktanın enleminde yerel düzlem yaklaşımı (yürüme ölçeğinde hata ihmal edilir).
 */
export function distanceToLineM(p: LngLat, line: readonly LngLat[]): number {
  if (line.length === 0) return Infinity;
  if (line.length === 1) return distanceM(p, line[0]!);
  const kx = R * rad(1) * Math.cos(rad(p[1]));
  const ky = R * rad(1);
  let best = Infinity;
  for (let i = 0; i < line.length - 1; i++) {
    const ax = (line[i]![0] - p[0]) * kx, ay = (line[i]![1] - p[1]) * ky;
    const bx = (line[i + 1]![0] - p[0]) * kx, by = (line[i + 1]![1] - p[1]) * ky;
    const dx = bx - ax, dy = by - ay;
    const len2 = dx * dx + dy * dy;
    const t = len2 === 0 ? 0 : Math.min(1, Math.max(0, -(ax * dx + ay * dy) / len2));
    best = Math.min(best, Math.hypot(ax + t * dx, ay + t * dy));
  }
  return best;
}

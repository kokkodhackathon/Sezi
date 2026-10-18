import { bearingDeg, distanceM, pointAlong, relativeBearing } from "./geo";
import type { Route, RouteGeometry } from "./routing";
import type { CueType, Instruction, LngLat, NavNode, NavSegment, UserProfile } from "./schemas";

/** Çizgi boyunca baştan en az `d` metre ilerideki ilk nokta (kısa geometri parçalarının yön gürültüsünü bastırır). */
function pointAway(line: LngLat[], d: number): LngLat {
  let acc = 0;
  for (let i = 1; i < line.length; i++) {
    acc += distanceM(line[i - 1]!, line[i]!);
    if (acc >= d) return line[i]!;
  }
  return line[line.length - 1]!;
}

export type Turn = "straight" | "slight_left" | "left" | "slight_right" | "right" | "back";

export function classifyTurn(rel: number): Turn {
  const a = Math.abs(rel);
  if (a < 20) return "straight";
  if (a > 160) return "back";
  if (rel < 0) return a < 60 ? "slight_left" : "left";
  return a < 60 ? "slight_right" : "right";
}

const TURN_TEXT: Record<"tr" | "en", Record<Turn, string>> = {
  tr: {
    straight: "düz devam edin",
    slight_left: "hafif sola yönelin",
    left: "sola dönün",
    slight_right: "hafif sağa yönelin",
    right: "sağa dönün",
    back: "geri dönün",
  },
  en: {
    straight: "continue straight",
    slight_left: "bear left",
    left: "turn left",
    slight_right: "bear right",
    right: "turn right",
    back: "turn around",
  },
};

/** Adımın türü: dönüş, yol üstü teyit, varış. */
export type StepKind = "turn" | "confirm" | "arrive";
/** Önümüzdeki segmentte dikkat gerektiren durum. */
export type Hazard = "stairs" | "cobble" | "traffic";

export interface GuidanceStep {
  nodeId: string;
  text: string;
  cueType: CueType;
  turn: Turn;
  /** Kaynağı elle yazılmış onaylı talimat mı, yoksa genel yedek mi. */
  authored: boolean;
  /** Düğümün rota başından uzaklığı (metre); geometri verilmediyse düğümler arası düz mesafe. */
  atM: number;
  /** Bu adımda yaklaşılan landmark (ses ipucu ve ekran için). */
  landmark?: { name: string; location: LngLat };
  kind?: StepKind;
  /** Önümüzdeki segmentte dikkat gerektiren durum (ekranda simge, titreşimde uyarı). */
  hazard?: Hazard;
}

/** Profile göre ipucu tipi tercih sırası. */
export function cuePreference(p: UserProfile): CueType[] {
  // Duymayan kullanıcıya ses ipucu verilmez; görsel ve dokunsal ipuçları öne geçer.
  if (p.hearing === "deaf") return p.vision === "blind" ? ["tactile", "generic"] : ["visual", "tactile", "generic"];
  if (p.vision === "blind") return ["sound", "tactile", "generic", "visual"];
  if (p.vision === "low") return ["sound", "visual", "tactile", "generic"];
  return ["visual", "sound", "tactile", "generic"];
}

function pickInstruction(
  candidates: Instruction[],
  prevNodeId: string | undefined,
  profile: UserProfile,
): Instruction | undefined {
  const order = cuePreference(profile);
  const verified = candidates.filter(
    (i) => i.status === "verified" && (!i.approachFrom || i.approachFrom === prevNodeId) && order.includes(i.cueType),
  );
  return verified.sort((a, b) => {
    // Yöne özel talimat genel olandan önce gelir.
    const dir = Number(!!b.approachFrom) - Number(!!a.approachFrom);
    if (dir !== 0) return dir;
    return order.indexOf(a.cueType) - order.indexOf(b.cueType);
  })[0];
}

const HAZARD_TEXT: Record<"tr" | "en", Record<Hazard, string>> = {
  tr: {
    stairs: "Ardından merdiven var.",
    cobble: "Zemin arnavut kaldırımına dönüyor.",
    traffic: "Trafiği yoğun bir caddeye çıkacaksınız, dikkatli olun.",
  },
  en: {
    stairs: "Stairs follow.",
    cobble: "The surface turns to cobblestone.",
    traffic: "You will reach a busy street, take care.",
  },
};

/** Yer adı ve sayı içermeyen dönüş cümlesi ("Sola dönün."); uyarı varsa arkasına eklenir. */
function bareTurnText(turn: Turn, lang: "tr" | "en", hazard?: Hazard): string {
  const t = TURN_TEXT[lang][turn];
  const text = t.charAt(0).toUpperCase() + t.slice(1) + ".";
  return hazard ? `${text} ${HAZARD_TEXT[lang][hazard]}` : text;
}

const arrivedText = (lang: "tr" | "en", name?: string) =>
  lang === "tr" ? `Vardınız${name ? `: ${name}` : ""}.` : `You have arrived${name ? `: ${name}` : ""}.`;

/**
 * Rotaya, yer adına ve mesafeye bağlı olmayan yönlendirme cümlelerinin tamamı.
 * Bunların sesi uygulamaya gömülebilir; adlı ve sayılı cümleler çalışırken üretilir.
 */
export function staticGuidanceTexts(lang: "tr" | "en"): string[] {
  const turns = Object.keys(TURN_TEXT[lang]) as Turn[];
  const hazards: (Hazard | undefined)[] = [undefined, ...(Object.keys(HAZARD_TEXT[lang]) as Hazard[])];
  return [...turns.flatMap((turn) => hazards.map((h) => bareTurnText(turn, lang, h))), arrivedText(lang)];
}

/** Gürültü değeri bu eşiği aşan segment ana cadde sayılır (OSM yol sınıfından tahmin). */
const TRAFFIC_NOISE = 0.6;
/** İki talimat arası bu mesafeyi aşarsa yol üstünde teyit verilir ("doğru yoldasınız"). */
const CONFIRM_GAP_M = 90;
/** Dönüş düğümüne bu kadar yakın landmark talimatta yer işareti olarak anılır. */
const NEAR_LANDMARK_M = 35;

function hazardOf(seg: NavSegment | undefined, prev: NavSegment | undefined, profile: UserProfile): Hazard | undefined {
  if (!seg) return undefined;
  if (seg.steps > 0 && profile.mobility !== "wheelchair") return "stairs";
  if (seg.noise >= TRAFFIC_NOISE && (prev?.noise ?? 0) < TRAFFIC_NOISE) return "traffic";
  if (seg.surface === "cobble" && prev?.surface !== "cobble") return "cobble";
  return undefined;
}

/** Konuma en yakın landmark (rota üstünde olması gerekmez), en fazla `maxM` uzaklıkta. */
function nearestLandmark(nodes: Map<string, NavNode>, p: LngLat, maxM: number, lang: "tr" | "en", exclude?: string) {
  let best: { node: NavNode; name: string; d: number } | undefined;
  for (const n of nodes.values()) {
    if (n.lynchType !== "landmark" || n.id === exclude) continue;
    const name = n.name?.[lang] ?? n.name?.tr;
    if (!name) continue;
    const d = distanceM(p, n.location);
    if (d <= maxM && (!best || d < best.d)) best = { node: n, name, d };
  }
  return best;
}

/** Rotanın `k`. düğümündeki dönüş (gelen ve giden kolun ilk 10 m'sinden); son düğümde düz. */
export function turnAt(route: Route, k: number, nodes: Map<string, NavNode>, geometry?: RouteGeometry): Turn {
  const ids = route.nodeIds;
  const nextId = ids[k + 1];
  if (k <= 0 || !nextId) return "straight";
  const node = nodes.get(ids[k]!)!;
  const legIn = geometry?.legs[k - 1];
  const legOut = geometry?.legs[k];
  const inBearing = legIn && legOut ? bearingDeg(pointAway([...legIn].reverse(), 10), node.location) : bearingDeg(nodes.get(ids[k - 1]!)!.location, node.location);
  const outBearing = legIn && legOut ? bearingDeg(node.location, pointAway(legOut, 10)) : bearingDeg(node.location, nodes.get(nextId)!.location);
  return classifyTurn(relativeBearing(inBearing, outBearing));
}

/** Göreli açıyı (+ sağ) yan bilgisine çevirir. */
export function sideText(rel: number, lang: "tr" | "en"): string {
  const a = Math.abs(rel);
  if (lang === "tr") return a < 30 ? "önünüzde" : a > 150 ? "arkanızda" : rel > 0 ? "sağınızda" : "solunuzda";
  return a < 30 ? "ahead of you" : a > 150 ? "behind you" : rel > 0 ? "on your right" : "on your left";
}

/**
 * Rotadaki her ara node ve varış için yönlendirme adımlarını üretir.
 * `segments` verilirse Lynch dili zenginleşir: önümüzdeki merdiven, zemin ve cadde uyarıları,
 * dönüşte yakındaki yer işareti, uzun düzlüklerde "doğru yoldasınız" teyidi.
 */
export function buildGuidance(
  route: Route,
  nodes: Map<string, NavNode>,
  instructions: Instruction[],
  profile: UserProfile,
  geometry?: RouteGeometry,
  segments?: Map<string, NavSegment>,
): GuidanceStep[] {
  const byNode = new Map<string, Instruction[]>();
  for (const i of instructions) {
    const list = byNode.get(i.nodeId) ?? [];
    list.push(i);
    byNode.set(i.nodeId, list);
  }

  const lang = profile.lang;
  const cumulative = (k: number) => {
    let d = 0;
    for (let i = 1; i <= k; i++) d += distanceM(nodes.get(route.nodeIds[i - 1]!)!.location, nodes.get(route.nodeIds[i]!)!.location);
    return d;
  };
  const segAt = (k: number) => (segments ? segments.get(route.segmentIds[k] ?? "") : undefined);
  const steps: GuidanceStep[] = [];
  const ids = route.nodeIds;

  for (let k = 1; k < ids.length; k++) {
    const prevId = ids[k - 1]!;
    const id = ids[k]!;
    const nextId = ids[k + 1];
    const node = nodes.get(id)!;

    const turn = turnAt(route, k, nodes, geometry);
    const atM = geometry?.nodeAtM[k] ?? cumulative(k);
    const lmName = node.lynchType === "landmark" ? (node.name?.[lang] ?? node.name?.tr) : undefined;
    const landmark = lmName ? { name: lmName, location: node.location } : undefined;
    const kind: StepKind = nextId ? "turn" : "arrive";
    const hazard = nextId ? hazardOf(segAt(k), segAt(k - 1), profile) : undefined;

    const authored = pickInstruction(byNode.get(id) ?? [], prevId, profile);
    if (authored) {
      steps.push({ nodeId: id, text: authored.text[lang] ?? authored.text.tr, cueType: authored.cueType, turn, authored: true, atM, landmark, kind, hazard });
      continue;
    }

    // Düz geçilen, isimsiz ara node'larda konuşma (uyarı yoksa): bilişsel yükü azaltır.
    if (nextId && turn === "straight" && node.lynchType === "node" && !hazard) continue;

    const name = node.name?.[lang] ?? node.name?.tr;
    // Dönüş düğümü landmark değilse yakındaki yer işareti anılır (Lynch: yön, mekândan okunur).
    const near = segments && !name && nextId && turn !== "straight" ? nearestLandmark(nodes, node.location, NEAR_LANDMARK_M, lang, ids[0]) : undefined;
    let text: string;
    if (!nextId) {
      text = arrivedText(lang, name);
    } else if (name) {
      text = lang === "tr" ? `${name} hizasında ${TURN_TEXT.tr[turn]}.` : `At ${name}, ${TURN_TEXT.en[turn]}.`;
    } else if (near) {
      text = lang === "tr" ? `${near.name} yakınında ${TURN_TEXT.tr[turn]}.` : `Near ${near.name}, ${TURN_TEXT.en[turn]}.`;
    } else {
      // Adsız dönüş: cümle sabit (uyarısıyla birlikte); sesi uygulamaya gömülü.
      text = bareTurnText(turn, lang, hazard);
    }
    if (hazard && (name || near)) text += ` ${HAZARD_TEXT[lang][hazard]}`;
    steps.push({
      nodeId: id,
      text,
      cueType: "generic",
      turn,
      authored: false,
      atM,
      landmark: landmark ?? (near ? { name: near.name, location: near.node.location } : undefined),
      kind,
      hazard,
    });
  }

  if (!segments || !geometry) return steps;
  return withConfirmations(steps, route, nodes, geometry, lang);
}

/** Uzun düzlüklerin ortasına "doğru yoldasınız" teyidi ekler; yakında landmark varsa hangi yanda kaldığını söyler. */
function withConfirmations(steps: GuidanceStep[], route: Route, nodes: Map<string, NavNode>, geometry: RouteGeometry, lang: "tr" | "en"): GuidanceStep[] {
  const out: GuidanceStep[] = [];
  let prevAt = 0;
  for (const step of steps) {
    const gap = step.atM - prevAt;
    // Her 90 m'de bir teyit: uzun düzlükte kullanıcı yolda olduğundan emin olsun.
    const count = Math.ceil(gap / CONFIRM_GAP_M) - 1;
    for (let c = 1; c <= count; c++) {
      const mid = prevAt + (gap * c) / (count + 1);
      // Teyit, ortaya en yakın rota düğümüne bağlanır.
      let k = 0;
      for (let i = 0; i < geometry.nodeAtM.length; i++) if (Math.abs(geometry.nodeAtM[i]! - mid) < Math.abs(geometry.nodeAtM[k]! - mid)) k = i;
      const p = pointAlong(geometry.line, mid);
      const heading = bearingDeg(p, pointAlong(geometry.line, mid + 8));
      const lm = nearestLandmark(nodes, p, 45, lang, route.nodeIds[0]);
      const left = Math.round(step.atM - mid);
      const side = lm ? sideText(relativeBearing(heading, bearingDeg(p, lm.node.location)), lang) : "";
      const text = lm
        ? lang === "tr"
          ? `Doğru yoldasınız. ${lm.name} ${side}.`
          : `You are on track. ${lm.name} is ${side}.`
        : lang === "tr"
          ? `Doğru yoldasınız; yaklaşık ${left} metre düz devam edin.`
          : `You are on track; continue straight for about ${left} metres.`;
      out.push({
        nodeId: route.nodeIds[k]!,
        text,
        cueType: "generic",
        turn: "straight",
        authored: false,
        atM: mid,
        landmark: lm ? { name: lm.name, location: lm.node.location } : undefined,
        kind: "confirm",
      });
    }
    out.push(step);
    prevAt = step.atM;
  }
  return out;
}

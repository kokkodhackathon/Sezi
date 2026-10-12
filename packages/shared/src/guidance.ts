import { bearingDeg, distanceM, relativeBearing } from "./geo";
import type { Route, RouteGeometry } from "./routing";
import type { CueType, Instruction, LngLat, NavNode, UserProfile } from "./schemas";

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
}

/** Profile göre ipucu tipi tercih sırası. */
function cuePreference(p: UserProfile): CueType[] {
  if (p.vision === "blind") return ["sound", "tactile", "generic", "visual"];
  if (p.vision === "low") return ["sound", "visual", "tactile", "generic"];
  return ["visual", "sound", "tactile", "generic"];
}

function pickInstruction(
  candidates: Instruction[],
  prevNodeId: string | undefined,
  profile: UserProfile,
): Instruction | undefined {
  const verified = candidates.filter(
    (i) => i.status === "verified" && (!i.approachFrom || i.approachFrom === prevNodeId),
  );
  const order = cuePreference(profile);
  return verified.sort((a, b) => {
    // Yöne özel talimat genel olandan önce gelir.
    const dir = Number(!!b.approachFrom) - Number(!!a.approachFrom);
    if (dir !== 0) return dir;
    return order.indexOf(a.cueType) - order.indexOf(b.cueType);
  })[0];
}

/** Rotadaki her ara node ve varış için yönlendirme adımlarını üretir. */
export function buildGuidance(
  route: Route,
  nodes: Map<string, NavNode>,
  instructions: Instruction[],
  profile: UserProfile,
  geometry?: RouteGeometry,
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
  const steps: GuidanceStep[] = [];
  const ids = route.nodeIds;

  for (let k = 1; k < ids.length; k++) {
    const prevId = ids[k - 1]!;
    const id = ids[k]!;
    const nextId = ids[k + 1];
    const node = nodes.get(id)!;

    let turn: Turn = "straight";
    if (nextId) {
      let inBearing: number;
      let outBearing: number;
      const legIn = geometry?.legs[k - 1];
      const legOut = geometry?.legs[k];
      if (legIn && legOut) {
        inBearing = bearingDeg(pointAway([...legIn].reverse(), 10), node.location);
        outBearing = bearingDeg(node.location, pointAway(legOut, 10));
      } else {
        inBearing = bearingDeg(nodes.get(prevId)!.location, node.location);
        outBearing = bearingDeg(node.location, nodes.get(nextId)!.location);
      }
      turn = classifyTurn(relativeBearing(inBearing, outBearing));
    }
    const atM = geometry?.nodeAtM[k] ?? cumulative(k);
    const lmName = node.lynchType === "landmark" ? (node.name?.[lang] ?? node.name?.tr) : undefined;
    const landmark = lmName ? { name: lmName, location: node.location } : undefined;

    const authored = pickInstruction(byNode.get(id) ?? [], prevId, profile);
    if (authored) {
      steps.push({
        nodeId: id,
        text: authored.text[lang] ?? authored.text.tr,
        cueType: authored.cueType,
        turn,
        authored: true,
        atM,
        landmark,
      });
      continue;
    }

    // Düz geçilen, isimsiz ara node'larda konuşma: bilişsel yükü azaltır.
    if (nextId && turn === "straight" && node.lynchType === "node") continue;

    const name = node.name?.[lang] ?? node.name?.tr;
    let text: string;
    if (!nextId) {
      text = lang === "tr" ? `Vardınız${name ? `: ${name}` : ""}.` : `You have arrived${name ? `: ${name}` : ""}.`;
    } else if (name) {
      text = lang === "tr" ? `${name} hizasında ${TURN_TEXT.tr[turn]}.` : `At ${name}, ${TURN_TEXT.en[turn]}.`;
    } else {
      const t = TURN_TEXT[lang][turn];
      text = t.charAt(0).toUpperCase() + t.slice(1) + ".";
    }
    steps.push({ nodeId: id, text, cueType: "generic", turn, authored: false, atM, landmark });
  }
  return steps;
}

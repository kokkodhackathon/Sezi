import { describe, expect, it } from "vitest";
import { gainForDistance, SOUND_RANGE_M, soundKindFor, soundscapeMix, type SoundSource } from "./soundscape";
import type { LngLat } from "./schemas";

const me: LngLat = [29.0618, 40.1838];
// ~20 m doğu ve ~40 m batı
const east: SoundSource = { id: "e", name: "Sebil", kind: "water", location: [29.06203, 40.1838] };
const west: SoundSource = { id: "w", name: "Han", kind: "market", location: [29.06133, 40.1838] };
const far: SoundSource = { id: "f", name: "Uzak", kind: "chime", location: [29.0640, 40.1838] };

describe("ses manzarası", () => {
  it("ses düzeyi uzaklıkla düşer, menzil dışında sıfır", () => {
    expect(gainForDistance(2)).toBe(1);
    expect(gainForDistance(30)).toBeGreaterThan(gainForDistance(50));
    expect(gainForDistance(SOUND_RANGE_M)).toBe(0);
  });

  it("kuzeye bakarken doğudaki ses sağda, batıdaki solda; yakın olan önde", () => {
    const mix = soundscapeMix(me, 0, [west, east, far]);
    expect(mix.map((v) => v.id)).toEqual(["e", "w"]);
    expect(mix[0]!.pan).toBeGreaterThan(0.9);
    expect(mix[1]!.pan).toBeLessThan(-0.9);
  });

  it("dönünce panlama da döner", () => {
    const [v] = soundscapeMix(me, 90, [east]);
    expect(Math.abs(v!.pan)).toBeLessThan(0.1);
  });

  it("eser türü ortam sesine eşlenir", () => {
    expect(soundKindFor("sebil")).toBe("water");
    expect(soundKindFor("han")).toBe("market");
    expect(soundKindFor("cami")).toBe("chime");
  });
});

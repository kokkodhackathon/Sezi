import { describe, expect, it } from "vitest";

import { createSpeechQueue, type SpeechEngine } from "./speech-queue";

interface U {
  text: string;
  onDone?: () => void;
}

/** Elle bitirilen sahte ses: `end()` çalan sesi bitirir. */
function fakeEngine() {
  const log: string[] = [];
  let current: { text: string; isCurrent: () => boolean; finish: () => void } | null = null;
  const engine: SpeechEngine<U> = {
    play(u, isCurrent, finish) {
      log.push(`play:${u.text}`);
      current = { text: u.text, isCurrent, finish };
    },
    stop() {
      if (current) log.push(`stop:${current.text}`);
      current = null;
    },
  };
  return {
    engine,
    log,
    end() {
      const c = current;
      current = null;
      if (c?.isCurrent()) c.finish();
    },
  };
}

describe("createSpeechQueue", () => {
  it("normal talimat okunanı kesmez, bitince okunur; arada gelen daha yenisi eskisini atar", () => {
    const f = fakeEngine();
    const q = createSpeechQueue(f.engine);
    q.say({ text: "a" });
    q.say({ text: "b" });
    q.say({ text: "c" });
    f.end();
    expect(f.log).toEqual(["play:a", "play:c"]);
  });

  it("onDone içinde başlayan sonraki cümle, araya gelen normal talimatla kesilmez (eşli okuma)", () => {
    const f = fakeEngine();
    const q = createSpeechQueue(f.engine);
    const sentences = ["1", "2", "3"];
    const read = (i: number) => {
      if (i < sentences.length) q.say({ text: sentences[i]!, onDone: () => read(i + 1) }, true);
    };
    read(0);
    f.end(); // 1 bitti → 2 başladı
    q.say({ text: "araya" }); // 2 çalarken: kuyruğa girmeli, 2'yi kesmemeli
    expect(f.log).toEqual(["play:1", "play:2"]);
    f.end(); // 2 bitti → 3 kesmeyle başlar (bekleyen düşer: interrupt kuralı)
    f.end(); // 3 bitti
    expect(f.log).toEqual(["play:1", "play:2", "play:3"]);
  });

  it("onDone normal talimatla devam ederse bekleyen sırasını korur", () => {
    const f = fakeEngine();
    const q = createSpeechQueue(f.engine);
    q.say({ text: "a", onDone: () => q.say({ text: "devam" }) });
    q.say({ text: "bekleyen" });
    f.end(); // a bitti → devam başlar, bekleyen sırada
    expect(f.log).toEqual(["play:a", "play:devam"]);
    f.end();
    expect(f.log).toEqual(["play:a", "play:devam", "play:bekleyen"]);
  });

  it("durdurulan konuşmanın geç gelen bitişi yeni konuşmayı ilerletmez", () => {
    const f = fakeEngine();
    let late: (() => void) | null = null;
    const q = createSpeechQueue<U>({
      play(u, isCurrent, finish) {
        f.log.push(`play:${u.text}`);
        if (u.text === "eski") late = () => isCurrent() && finish();
      },
      stop() {},
    });
    let done = 0;
    q.say({ text: "eski", onDone: () => done++ });
    q.stop();
    q.say({ text: "yeni" });
    late!();
    expect(done).toBe(0);
  });
});

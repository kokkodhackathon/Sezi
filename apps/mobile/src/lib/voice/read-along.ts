import { useCallback, useEffect, useRef, useState } from 'react';

import { prefetchChirp } from './chirp';
import { NARRATION_WAIT_MS, say, silence } from './speech';

export interface ReadAlong {
  /** Okunan bölüm (ör. 'history'); okuma yoksa null. */
  active: string | null;
  /** Bölüm içinde okunan cümlenin sırası (düz liste). */
  index: number;
  start: (key: string, sentences: string[]) => void;
  stop: () => void;
}

/**
 * Eşli okuma: bölüm metni cümle cümle seslendirilir, sayfa okunan cümleyi vurgular. Türkçede sonraki cümlelerin
 * Chirp sesi arkadan hazırlanır; durdurulan okumanın geç gelen geri çağrısı yeni okumayı ilerletmez (nesil sayacı).
 */
export function useReadAlong({ lang, rate }: { lang: 'tr' | 'en'; rate: number }): ReadAlong {
  const [active, setActive] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const generation = useRef(0);

  const stop = useCallback(() => {
    generation.current++;
    silence();
    setActive(null);
    setIndex(0);
  }, []);

  const start = useCallback(
    (key: string, sentences: string[]) => {
      const gen = ++generation.current;
      setActive(key);
      if (lang === 'tr') void prefetchChirp(sentences.slice(1));
      const speak = (i: number) => {
        if (gen !== generation.current) return;
        if (i >= sentences.length) {
          setActive(null);
          setIndex(0);
          return;
        }
        setIndex(i);
        say(sentences[i]!, { lang, rate, interrupt: true, waitMs: NARRATION_WAIT_MS, onDone: () => speak(i + 1) });
      };
      speak(0);
    },
    [lang, rate],
  );

  useEffect(
    () => () => {
      generation.current++;
      silence();
    },
    [],
  );

  return { active, index, start, stop };
}

import { type SweetTheme } from '@sezi/shared';
import { Fragment, useEffect, useEffectEvent, useRef } from 'react';
import { Text, View } from 'react-native';

import { space, type } from '@/design/type';

/**
 * Okunan metnin tamamı; seslendirilen cümle vurgulu (dolgu + alt çizgi, renkten bağımsız). Okunan cümle yeni bir
 * paragrafa geçince `onParagraph` o paragrafın görünür kalması için çağrılır.
 */
export function ReadAlongText({
  paragraphs,
  current,
  t,
  onParagraph,
}: {
  paragraphs: string[][];
  current: number;
  t: SweetTheme;
  onParagraph?: (node: View) => void;
}) {
  const nodes = useRef<(View | null)[]>([]);
  const starts = paragraphs.map((_, i) => paragraphs.slice(0, i).reduce((n, p) => n + p.length, 0));
  const paragraphIndex = starts.findLastIndex((at) => at <= current);
  const reveal = useEffectEvent((i: number) => {
    const node = nodes.current[i];
    if (node) onParagraph?.(node);
  });

  // Yalnız paragraf değişince kaydırılır (her cümlede değil).
  useEffect(() => {
    reveal(paragraphIndex);
  }, [paragraphIndex]);

  return (
    <View style={{ gap: space.md }}>
      {paragraphs.map((p, pi) => (
        <View key={pi} ref={(node) => { nodes.current[pi] = node; }}>
          <Text style={[type.body, { color: t.text }]}>
            {p.map((sentence, si) => {
              const on = starts[pi]! + si === current;
              return (
                <Fragment key={si}>
                  {si > 0 ? ' ' : null}
                  <Text
                    style={on ? { backgroundColor: t.outlined ? t.background : t.primary.fill, color: t.outlined ? t.text : t.primary.ink, textDecorationLine: 'underline', fontFamily: type.button.fontFamily } : undefined}>
                    {sentence}
                  </Text>
                </Fragment>
              );
            })}
          </Text>
        </View>
      ))}
    </View>
  );
}

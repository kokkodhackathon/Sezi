import { excerpt } from '@sezi/shared';
import { useState } from 'react';
import { Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { Button } from '@/components/ui';
import { ChevronIcon } from '@/design/icons';
import { duration } from '@/design/sweet/motion';
import { space, type } from '@/design/type';
import { useSweetTheme } from '@/hooks/use-sweet-theme';
import { useT } from '@/lib/i18n';

/** Bundan kısa metin kırpılmaz (kırpılsa kazanç olmaz). */
const SHORT = 600;
/** Kapalı hâlin uzunluğu: ilk paragraflar, son tam cümlede kesilir. */
const PREVIEW = 360;
/** Okuma hızı (karakter/dk): ~200 sözcük × ~7 harf. */
const CHARS_PER_MIN = 1300;

const paragraphs = (text: string) => text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);

/**
 * Uzun metin: önce kısa hâli, "Devamını oku" ile tamamı (okuma süresiyle). Paragraflar arası boşluklu.
 * Açılan kısım yalnız saydamlıkla gelir (kayma yok, reduce motion'da da aynı). "Kısalt" kapatır ve
 * `onCollapse` ile sayfayı bölümün başına döndürür (uzun metnin sonunda kalınmasın).
 */
export function ReadMore({ text, onCollapse }: { text: string; onCollapse?: () => void }) {
  const t = useSweetTheme();
  const { t: tr } = useT();
  const [open, setOpen] = useState(false);
  const long = text.length > SHORT;
  const shown = !long || open ? paragraphs(text) : [excerpt(text, PREVIEW)];
  const minutes = Math.max(1, Math.round(text.length / CHARS_PER_MIN));

  return (
    <View style={{ gap: space.md }}>
      {shown.map((p, i) =>
        i === 0 ? (
          <Text key={i} style={[type.body, { color: t.text }]}>
            {p}
          </Text>
        ) : (
          <Animated.Text key={i} entering={FadeIn.duration(duration.fade)} style={[type.body, { color: t.text }]}>
            {p}
          </Animated.Text>
        ),
      )}
      {long ? (
        <Button
          compact
          variant="ghost"
          style={{ alignSelf: 'flex-start' }}
          label={open ? tr('work.readLess') : tr('work.readMore', { n: minutes })}
          hint={open ? undefined : tr('work.readMoreHint')}
          icon={(c) => (
            <View style={{ transform: [{ rotate: open ? '-90deg' : '90deg' }] }}>
              <ChevronIcon color={c} />
            </View>
          )}
          onPress={() => {
            if (open) onCollapse?.();
            setOpen(!open);
          }}
        />
      ) : null}
    </View>
  );
}

import type { Identity } from '@sezi/shared';
import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';

import { PersonIcon } from '@/design/icons';
import { font } from '@/design/type';
import { useSweetTheme } from '@/hooks/use-sweet-theme';
import { initials } from '@/lib/identity';

/**
 * Profil dairesi: fotoğraf varsa fotoğraf, yoksa seçilen Çini 2 tonunda baş harfler; ad yoksa (girişsiz, yükleniyor)
 * kişi simgesi, boş daire hiç görünmez. Dekoratiftir: kimin olduğu yanındaki adla söylenir. Fotoğraf yüklenemezse
 * (internet yok, önbellekte yok) baş harfler görünür kalır.
 */
export function Avatar({
  identity,
  source,
  size = 56,
}: {
  identity: Pick<Identity, 'display_name' | 'avatar_tone'> | null;
  source?: { uri: string; headers: Record<string, string> } | null;
  size?: number;
}) {
  const t = useSweetTheme();
  const tone = t.tones[identity?.avatar_tone ?? 'teal'];
  const letters = initials(identity?.display_name ?? '');
  return (
    <View
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={[styles.circle, { width: size, height: size, borderRadius: size / 2, backgroundColor: tone.fill }, t.outlined && { borderWidth: 2, borderColor: t.border }]}>
      {letters ? (
        <Text style={{ fontFamily: font.round, fontSize: size * 0.38, color: tone.ink }}>{letters}</Text>
      ) : (
        <PersonIcon color={tone.ink} size={size * 0.46} filled />
      )}
      {source ? <Image source={source} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="disk" transition={0} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  circle: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
});

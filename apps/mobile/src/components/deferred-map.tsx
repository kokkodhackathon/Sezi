import { Map, type MapProps } from '@maplibre/maplibre-react-native';
import { useEffect, useState } from 'react';
import { InteractionManager, StyleSheet, View } from 'react-native';

import { useIsDark, useSeziTheme } from '@/hooks/use-sezi-theme';
import { useProfile } from '@/lib/profile';

const STYLES = {
  light: 'https://tiles.openfreemap.org/styles/liberty',
  dark: 'https://tiles.openfreemap.org/styles/dark',
  // Az gören profili: sade, düşük gürültülü harita (yüksek kontrast tema ile).
  plain: 'https://tiles.openfreemap.org/styles/positron',
};

/**
 * MapLibre haritası, ekranın ilk çizimi ve geçiş animasyonu bittikten sonra yüklenir.
 * RN 0.86 Fabric'te harita, büyük bir ilk commit ile aynı anda yüklenince ara sıra
 * MountingCoordinator::pullTransaction içinde çöküyor; ertelemek bu yarışı ortadan kaldırır.
 */
export function DeferredMap({ children, ...props }: Omit<MapProps, 'mapStyle'> & { mapStyle?: MapProps['mapStyle'] }) {
  const t = useSeziTheme();
  const dark = useIsDark();
  const { profile } = useProfile();
  const style = profile?.vision === 'low' ? STYLES.plain : dark ? STYLES.dark : STYLES.light;
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const task = InteractionManager.runAfterInteractions(() => {
      timer = setTimeout(() => setReady(true), 120);
    });
    return () => {
      task.cancel();
      clearTimeout(timer);
    };
  }, []);

  if (!ready) return <View style={[StyleSheet.absoluteFill, { backgroundColor: t.surface }]} />;
  return (
    <Map key={style} style={StyleSheet.absoluteFill} mapStyle={style} {...props}>
      {children}
    </Map>
  );
}

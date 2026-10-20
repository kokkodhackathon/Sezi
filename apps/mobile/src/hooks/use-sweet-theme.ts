import { sweetThemes, type SweetTheme } from '@sezi/shared';
import { useColorScheme } from 'react-native';

import { useProfile } from '@/lib/profile';
import { useSettings } from '@/lib/settings';

/** Uygulama teması. Öncelik: az gören profili → yüksek kontrast; sonra ayardaki tema; "sistem" ise cihaz tercihi. */
export function useSweetTheme(): SweetTheme {
  const scheme = useColorScheme();
  const { profile } = useProfile();
  const { settings } = useSettings();
  if (profile?.vision === 'low') return sweetThemes.highContrast;
  const mode = settings.themeMode === 'system' ? (scheme === 'dark' ? 'dark' : 'light') : settings.themeMode;
  return sweetThemes[mode];
}

/** Koyu tema etkin mi (durum çubuğu ve gezinti teması için). Yüksek kontrast açık temadır. */
export function useIsDark(): boolean {
  const scheme = useColorScheme();
  const { settings } = useSettings();
  const { profile } = useProfile();
  if (profile?.vision === 'low') return false;
  return settings.themeMode === 'dark' || (settings.themeMode === 'system' && scheme === 'dark');
}

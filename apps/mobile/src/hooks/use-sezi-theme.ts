import { themes, type ThemeColors } from '@sezi/shared';
import { useColorScheme } from 'react-native';

import { useProfile } from '@/lib/profile';
import { useSettings } from '@/lib/settings';

/** Öncelik: az gören profili → yüksek kontrast; sonra ayarlardaki tema; "sistem" ise cihaz tercihi. */
export function useSeziTheme(): ThemeColors {
  const scheme = useColorScheme();
  const { profile } = useProfile();
  const { settings } = useSettings();
  if (profile?.vision === 'low') return themes.highContrast;
  const mode = settings.themeMode === 'system' ? (scheme === 'dark' ? 'dark' : 'light') : settings.themeMode;
  return themes[mode];
}

export function useIsDark(): boolean {
  const scheme = useColorScheme();
  const { settings } = useSettings();
  const { profile } = useProfile();
  if (profile?.vision === 'low') return false;
  return settings.themeMode === 'dark' || (settings.themeMode === 'system' && scheme === 'dark');
}

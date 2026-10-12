import { themes, type ThemeColors } from '@sezi/shared';
import { useColorScheme } from 'react-native';

import { useProfile } from '@/lib/profile';

/** Az gören kullanıcı profili yüksek kontrast temayı açar; diğerlerinde sistem açık/koyu tercihi izlenir. */
export function useSeziTheme(): ThemeColors {
  const scheme = useColorScheme();
  const { profile } = useProfile();
  if (profile?.vision === 'low') return themes.highContrast;
  return themes[scheme === 'dark' ? 'dark' : 'light'];
}

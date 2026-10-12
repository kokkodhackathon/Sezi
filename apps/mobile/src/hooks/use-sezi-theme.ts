import { themes, type ThemeColors } from '@sezi/shared';
import { useColorScheme } from 'react-native';

export function useSeziTheme(): ThemeColors {
  return themes[useColorScheme() === 'dark' ? 'dark' : 'light'];
}

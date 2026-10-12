import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { useSeziTheme } from '@/hooks/use-sezi-theme';

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 5 * 60_000, retry: 1 } },
});

export default function RootLayout() {
  const dark = useColorScheme() === 'dark';
  const t = useSeziTheme();
  const navTheme = dark ? DarkTheme : DefaultTheme;

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider
        value={{
          ...navTheme,
          colors: { ...navTheme.colors, background: t.background, card: t.surface, text: t.text, primary: t.primary, border: t.border },
        }}>
        <AnimatedSplashOverlay />
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="work/[slug]" options={{ title: '', headerBackTitle: 'Geri' }} />
        </Stack>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

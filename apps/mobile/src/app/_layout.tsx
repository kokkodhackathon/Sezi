import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { useSeziTheme } from '@/hooks/use-sezi-theme';
import { useT } from '@/lib/i18n';
import { ProfileProvider, useProfile } from '@/lib/profile';

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 5 * 60_000, retry: 1 } },
});

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <ProfileProvider>
        <AppStack />
      </ProfileProvider>
    </QueryClientProvider>
  );
}

function AppStack() {
  const dark = useColorScheme() === 'dark';
  const t = useSeziTheme();
  const { profile } = useProfile();
  const { t: tr } = useT();
  const navTheme = dark ? DarkTheme : DefaultTheme;

  return (
    <ThemeProvider
      value={{
        ...navTheme,
        colors: { ...navTheme.colors, background: t.background, card: t.surface, text: t.text, primary: t.primary, border: t.border },
      }}>
      <AnimatedSplashOverlay />
      <Stack>
        {/* Profil yoksa uygulama onboarding'e yönlenir. */}
        <Stack.Protected guard={profile !== null}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="work/[slug]" options={{ title: '', headerBackTitle: tr('onb.back') }} />
        </Stack.Protected>
        <Stack.Screen name="onboarding" options={{ headerShown: false, gestureEnabled: profile !== null }} />
      </Stack>
    </ThemeProvider>
  );
}

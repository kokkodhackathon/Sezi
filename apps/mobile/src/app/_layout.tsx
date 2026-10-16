import { useFonts } from 'expo-font';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { fontAssets, font } from '@/design/type';
import { useSeziTheme , useIsDark } from '@/hooks/use-sezi-theme';
import { useT } from '@/lib/i18n';
import { ProfileProvider, useProfile } from '@/lib/profile';
import { SettingsProvider } from '@/lib/settings';
import { useStorySync } from '@/lib/story';
import { useServerSync } from '@/lib/sync';

import { useReducedMotion } from '@/hooks/use-reduced-motion';

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 5 * 60_000, retry: 1 } },
});

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts(fontAssets);

  useEffect(() => {
    if (fontsLoaded || fontError) SplashScreen.hideAsync();
  }, [fontsLoaded, fontError]);

  // Yazı tipi yüklenemezse sistem yazı tipiyle devam edilir; açılış asla takılı kalmaz.
  if (!fontsLoaded && !fontError) return null;

  return (
    <QueryClientProvider client={queryClient}>
      <ProfileProvider>
        <SettingsProvider>
          <AppStack />
        </SettingsProvider>
      </ProfileProvider>
    </QueryClientProvider>
  );
}

function AppStack() {
  useServerSync();
  useStorySync();
  const reducedMotion = useReducedMotion();
  const dark = useIsDark();
  const t = useSeziTheme();
  const { profile } = useProfile();
  const { t: tr } = useT();
  const navTheme = dark ? DarkTheme : DefaultTheme;

  return (
    <ThemeProvider
      value={{
        ...navTheme,
        colors: { ...navTheme.colors, background: t.background, card: t.background, text: t.text, primary: t.primary, border: t.border },
      }}>
      <StatusBar style={dark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          animation: reducedMotion ? 'none' : 'fade',
          headerShadowVisible: false,
          headerTintColor: t.text,
          headerTitleStyle: { fontFamily: font.bodySemi, fontSize: 17 },
          contentStyle: { backgroundColor: t.background },
        }}>
        {/* Profil yoksa uygulama onboarding'e yönlenir. */}
        <Stack.Protected guard={profile !== null}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="work/[slug]" options={{ title: '', headerBackTitle: tr('onb.back') }} />
          <Stack.Screen name="route/[slug]" options={{ title: '', headerBackTitle: tr('onb.back') }} />
          <Stack.Screen name="compare/[slug]" options={{ title: tr('compare.title') }} />
          <Stack.Screen name="guide/[slug]" options={{ headerShown: false, presentation: 'fullScreenModal', animation: reducedMotion ? 'none' : 'fade' }} />
          <Stack.Screen name="complex/[slug]" options={{ title: '' }} />
          <Stack.Screen name="tour/[id]" options={{ title: '' }} />
          <Stack.Screen name="city/[slug]" options={{ title: '' }} />
          <Stack.Screen name="exhibitions" options={{ title: tr('exh.title') }} />
          <Stack.Screen name="search" options={{ title: tr('search.title'), animation: reducedMotion ? 'none' : 'fade_from_bottom' }} />
          <Stack.Screen name="report/new" options={{ title: tr('report.title'), presentation: 'modal' }} />
          <Stack.Screen name="reports" options={{ title: tr('reports.title') }} />
          <Stack.Screen name="sign-in" options={{ title: tr('signin.title'), presentation: 'modal' }} />
          <Stack.Screen name="settings" options={{ title: tr('settings.title') }} />
          <Stack.Screen name="about" options={{ title: tr('about.title') }} />
          <Stack.Screen name="lab" options={{ title: tr('settings.device') }} />
          <Stack.Screen name="walk" options={{ title: tr('walk.title'), headerBackTitle: tr('onb.back') }} />
        </Stack.Protected>
        <Stack.Screen name="onboarding" options={{ headerShown: false, gestureEnabled: profile !== null }} />
      </Stack>
    </ThemeProvider>
  );
}

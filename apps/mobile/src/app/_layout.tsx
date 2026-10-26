import { useFonts } from 'expo-font';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { fontAssets, font } from '@/design/type';
import { useIsDark, useSweetTheme } from '@/hooks/use-sweet-theme';
import { AccountProvider } from '@/lib/account';
import { PassportProvider } from '@/lib/passport';
import { AchievementWatcher } from '@/components/achievement-watcher';
import { useT } from '@/lib/i18n';
import { ProfileProvider, useProfile } from '@/lib/profile';
import { SettingsProvider } from '@/lib/settings';
import { usePointsSync } from '@/lib/points';
import { useServerSync } from '@/lib/sync';
import { useToursSync } from '@/lib/tours';

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
    <GestureHandlerRootView style={{ flex: 1 }}>
    <QueryClientProvider client={queryClient}>
      <ProfileProvider>
        <SettingsProvider>
          <AccountProvider>
            <PassportProvider>
              <AppStack />
            </PassportProvider>
          </AccountProvider>
        </SettingsProvider>
      </ProfileProvider>
    </QueryClientProvider>
    </GestureHandlerRootView>
  );
}

function AppStack() {
  useServerSync();
  usePointsSync();
  useToursSync();
  const reducedMotion = useReducedMotion();
  const dark = useIsDark();
  const t = useSweetTheme();
  const { profile } = useProfile();
  const { t: tr } = useT();
  const navTheme = dark ? DarkTheme : DefaultTheme;

  return (
    <ThemeProvider
      value={{
        ...navTheme,
        colors: { ...navTheme.colors, background: t.background, card: t.background, text: t.text, primary: t.primaryText, border: t.border },
      }}>
      <StatusBar style={dark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          animation: reducedMotion ? 'none' : 'fade',
          headerShadowVisible: false,
          headerTintColor: t.text,
          headerTitleStyle: { fontFamily: font.round, fontSize: 17 },
          contentStyle: { backgroundColor: t.background },
        }}>
        {/* Profil yoksa uygulama onboarding'e yönlenir. */}
        <Stack.Protected guard={profile !== null}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="work/[slug]" options={{ headerShown: false }} />
          <Stack.Screen name="navigate" options={{ headerShown: false, animation: reducedMotion ? 'none' : 'fade_from_bottom' }} />
          <Stack.Screen name="compare/[slug]" options={{ headerShown: false }} />
          <Stack.Screen name="complex/[slug]" options={{ title: '' }} />
          <Stack.Screen name="tour/[id]" options={{ headerShown: false }} />
          <Stack.Screen name="city/[slug]" options={{ headerShown: false }} />
          <Stack.Screen name="exhibitions" options={{ title: tr('exh.title') }} />
          <Stack.Screen name="search" options={{ title: tr('search.title'), animation: reducedMotion ? 'none' : 'fade_from_bottom' }} />
          <Stack.Screen name="report/new" options={{ title: tr('report.title'), presentation: 'modal' }} />
          <Stack.Screen name="reports" options={{ title: tr('reports.title') }} />
          <Stack.Screen name="passport" options={{ title: tr('passport.title') }} />
          <Stack.Screen name="achievements" options={{ title: tr('ach.title') }} />
          <Stack.Screen name="photos/index" options={{ title: tr('photos.title') }} />
          <Stack.Screen name="photos/new" options={{ title: tr('photos.add'), presentation: 'modal' }} />
          <Stack.Screen name="photos/[id]" options={{ title: tr('photos.title') }} />
          <Stack.Screen name="friends" options={{ title: tr('friends.title') }} />
          <Stack.Screen name="person/[id]" options={{ title: tr('person.title') }} />
          <Stack.Screen name="privacy" options={{ title: tr('privacy.title') }} />
          {/* Hesap isteğe bağlı: açılışta sorulmaz, Profil → Hesap'tan açılır. */}
          <Stack.Screen name="account/index" options={{ title: tr('account.title') }} />
          <Stack.Screen name="account/sign-in" options={{ title: tr('account.signIn') }} />
          <Stack.Screen name="account/sign-up" options={{ title: tr('account.signUp') }} />
          <Stack.Screen name="account/verify" options={{ title: tr('account.verifyTitle') }} />
          <Stack.Screen name="account/forgot" options={{ title: tr('account.forgotTitle') }} />
          <Stack.Screen name="account/reset-code" options={{ title: tr('account.forgotTitle') }} />
          <Stack.Screen name="account/password" options={{ title: tr('account.newPasswordTitle') }} />
          <Stack.Screen name="account/edit" options={{ title: tr('account.editProfile') }} />
          <Stack.Screen name="account/delete" options={{ title: tr('account.deleteTitle') }} />
          <Stack.Screen name="settings" options={{ title: tr('settings.title') }} />
          <Stack.Screen name="about" options={{ title: tr('about.title') }} />
          <Stack.Screen name="lab" options={{ title: tr('settings.device') }} />
        </Stack.Protected>
        <Stack.Screen name="onboarding" options={{ headerShown: false, gestureEnabled: profile !== null }} />
      </Stack>
      <AchievementWatcher />
    </ThemeProvider>
  );
}

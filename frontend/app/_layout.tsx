import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import FlashMessage from 'react-native-flash-message';
import 'react-native-reanimated';
import './globals.css';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { Image, View, Text, StyleSheet } from 'react-native';
import { useColorScheme } from '@/hooks/useColorScheme';
import { SQLiteProvider } from 'expo-sqlite';
import { migrateDbIfNeeded } from '@/database/db-setup';
import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  ShipporiMincho_600SemiBold,
  ShipporiMincho_700Bold,
  ShipporiMincho_800ExtraBold,
} from '@expo-google-fonts/shippori-mincho';
import {
  NotoSansJP_400Regular,
  NotoSansJP_500Medium,
  NotoSansJP_700Bold,
} from '@expo-google-fonts/noto-sans-jp';

const SUMI  = '#1C1410';
const BENI  = '#C0392B';
const KINCHA = '#B8963E';
const WASHI = '#FAF5EC';
const WHITE = '#FFFFFF';

SplashScreen.preventAutoHideAsync();

const CustomHeaderTitle = () => (
  <View style={hd.row}>
    <Image
      source={require('../assets/images/icon.png')}
      style={hd.logo}
      resizeMode="contain"
    />
    <Text style={hd.title}>TabiGo</Text>
  </View>
);

const hd = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logo: {
    width: 28, height: 28, borderRadius: 4,
    borderWidth: 1, borderColor: 'rgba(184,150,62,0.45)',
  },
  title: {
    fontSize: 16,
    fontFamily: 'ShipporiMincho_800ExtraBold',
    color: WHITE,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
});

const HEADER_OPTIONS = {
  headerTitle: () => <CustomHeaderTitle />,
  headerStyle: { backgroundColor: SUMI },
  headerTintColor: WHITE,
  headerShadowVisible: false,
  headerBottom: () => (
    <View style={{ height: 1, backgroundColor: KINCHA, opacity: 0.35 }} />
  ),
};

// ─── Onboarding gate ───────────────────────────────────────────────────────────
// แยก component ออกมาเพื่อให้ useRouter/useSegments ทำงานได้ภายใต้ Stack
function OnboardingGate({ children }: { children: React.ReactNode }) {
  const router   = useRouter();
  const segments = useSegments();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    (async () => {
      const done = await AsyncStorage.getItem('onboarding_done');
      const inOnboarding = segments[0] === 'onboarding';

      if (!done && !inOnboarding) {
        router.replace('/onboarding');
      }
      setChecked(true);
    })();
  }, []);

  if (!checked) return null;
  return <>{children}</>;
}

// ─── Root layout ───────────────────────────────────────────────────────────────
export default function RootLayout() {
  const colorScheme = useColorScheme();

  const [loaded, error] = useFonts({
    ShipporiMincho_600SemiBold,
    ShipporiMincho_700Bold,
    ShipporiMincho_800ExtraBold,
    NotoSansJP_400Regular,
    NotoSansJP_500Medium,
    NotoSansJP_700Bold,
  });

  useEffect(() => {
    GoogleSignin.configure({
      webClientId: '1061030412176-tmtkq6rgmr4biqpr8ir1sk902od0mu1e.apps.googleusercontent.com',
      offlineAccess: true,
    });

    if (loaded || error) SplashScreen.hideAsync();
  }, [loaded, error]);

  if (!loaded && !error) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <BottomSheetModalProvider>
        <SQLiteProvider databaseName="tabigo.db" onInit={migrateDbIfNeeded}>
          <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
            <Stack>
              {/* ── Onboarding (ไม่มี header) ── */}
              <Stack.Screen name="onboarding" options={{ headerShown: false, animation: 'fade' }} />

              <Stack.Screen name="(tabs)"      options={{ headerShown: false }} />
              <Stack.Screen name="(modals)"    options={{ headerShown: false }} />
              <Stack.Screen name="+not-found"  options={HEADER_OPTIONS} />

              <Stack.Screen name="trip/[trip_id]"              options={HEADER_OPTIONS} />
              <Stack.Screen name="trip/[trip_id]/budget"       options={HEADER_OPTIONS} />
              <Stack.Screen name="trip/[trip_id]/editschedule" options={HEADER_OPTIONS} />
              <Stack.Screen name="trip/after-create"           options={HEADER_OPTIONS} />
              <Stack.Screen name="trip/[trip_id]/member"       options={HEADER_OPTIONS} />
              <Stack.Screen name="trip/scheduledetail"         options={HEADER_OPTIONS} />
            </Stack>

            <OnboardingGate>{null}</OnboardingGate>

            <StatusBar style="light" backgroundColor={SUMI} />
            <FlashMessage position="top" />
          </ThemeProvider>
        </SQLiteProvider>
      </BottomSheetModalProvider>
    </GestureHandlerRootView>
  );
}
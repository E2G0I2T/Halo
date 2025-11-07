//app/_layout.tsx
import { ThemeProvider } from '@/theme/ThemeContext';
import { AuthProvider, useAuth } from '@/lib/contexts/AuthContext';
import { FavoritesProvider } from '@/lib/contexts/FavoritesContext';
import { RatingsProvider } from '@/lib/contexts/RatingsContext';
import { useFonts } from 'expo-font';
import { Stack, useRouter, useSegments, Slot } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import 'react-native-reanimated';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { View, ActivityIndicator } from 'react-native';

SplashScreen.preventAutoHideAsync();

function RootLayoutNav() {
  const { user, loading, isAuthReady } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const [isNavigationReady, setIsNavigationReady] = useState(false);

  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  useEffect(() => {
    if (loaded && isAuthReady) {
      SplashScreen.hideAsync();
    }
  }, [loaded, isAuthReady]);

  // ✅ Navigation 준비 확인
  useEffect(() => {
    if (loaded && isAuthReady && !loading) {
      // 약간의 지연을 주어 Root Layout이 완전히 마운트되도록 함
      const timer = setTimeout(() => {
        setIsNavigationReady(true);
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [loaded, isAuthReady, loading]);

  // ✅ Navigation 로직 - isNavigationReady가 true일 때만 실행
  useEffect(() => {
    if (!isNavigationReady) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!user && !inAuthGroup) {
      console.log('🔐 로그인 필요 → 로그인 화면으로 이동');
      router.replace('/(auth)/login');
    } else if (user && inAuthGroup) {
      console.log('✅ 로그인됨 → 메인 화면으로 이동');
      router.replace('/(tabs)');
    }
  }, [user, segments, isNavigationReady]);

  // ✅ 로딩 중에는 로딩 화면 표시
  if (!loaded || !isAuthReady || !isNavigationReady) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
        <ActivityIndicator size="large" color="#4285f4" />
      </View>
    );
  }

  return (
    <FavoritesProvider>
      <RatingsProvider>
        <Stack>
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="player" options={{ headerShown: false }} />
          <Stack.Screen name="+not-found" />
        </Stack>
      </RatingsProvider>
    </FavoritesProvider>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <AuthProvider>
          <RootLayoutNav />
        </AuthProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
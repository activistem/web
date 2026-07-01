import { useEffect } from 'react';
import { Stack, router, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider, useTheme } from '../lib/ThemeContext';
import { useSession } from '../lib/useSession';

function AuthGuard() {
  const { session, loading } = useSession();
  const segments = useSegments();

  useEffect(() => {
    if (loading) return;
    const inAuthGroup = segments[0] === '(auth)';
    if (!session && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (session && inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [session, loading, segments]);

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color="#7C5BF5" size="large" />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" options={{ animation: 'none' }} />
      <Stack.Screen name="(auth)" options={{ animation: 'none' }} />
      <Stack.Screen name="profile/[id]" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="settings" options={{ animation: 'slide_from_right' }} />
    </Stack>
  );
}

function ThemedRoot() {
  const { isDark, colors } = useTheme();
  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <AuthGuard />
    </View>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <ThemedRoot />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loading: {
    flex: 1,
    backgroundColor: '#080714',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

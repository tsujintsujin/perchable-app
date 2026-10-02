import { useEffect } from "react";
import { StyleSheet } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useFonts } from "expo-font";
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold } from "@expo-google-fonts/inter";
import { Poppins_700Bold, Poppins_800ExtraBold } from "@expo-google-fonts/poppins";
import { GoogleSans_500Medium } from "@expo-google-fonts/google-sans";
import { QueryClientProvider } from "@tanstack/react-query";
import { initSentry } from "@/lib/sentry";
import { queryClient } from "@/lib/queryClient";
import { AuthProvider, useAuthSession } from "@/modules/auth";
import { useClearQuickAddOnSignOut } from "@/modules/quick-add";

// Runs once at module load, before the first screen renders.
initSentry();

SplashScreen.preventAutoHideAsync();

// A cold start on a deep link (perchable://movie/<id>) gets Home underneath it, so back lands on Home instead of exiting.
export const unstable_settings = { anchor: "(tabs)" };

// Wraps the app in the one query client and the single shared auth listener
// before anything below (including the route guard, which needs it) renders.
export default function RootLayout() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <RootNavigator />
        </AuthProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}

function RootNavigator() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Poppins_700Bold,
    Poppins_800ExtraBold,
    // The one place that doesn't use the app's own type scale — Google's
    // button-text spec requires Google Sans.
    GoogleSans_500Medium,
  });
  const { session, isLoading: sessionLoading } = useAuthSession();
  // Removes the departing user's Quick Add skips when the session ends.
  useClearQuickAddOnSignOut(session?.user.id);

  const ready = fontsLoaded && !sessionLoading;

  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  // Block on load (DESIGN.md §1.6: "no system-font fallback screen") — both
  // font load and the initial session read must finish before any route
  // renders, since the route guard below depends on `session`.
  if (!ready) return null;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!!session}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="movie/[id]" />
      </Stack.Protected>
      <Stack.Protected guard={!session}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
      <Stack.Screen name="debug" />
    </Stack>
  );
}

const styles = StyleSheet.create({
  // The gesture root fills the screen so every swipe and drag has a root view.
  root: { flex: 1 },
});

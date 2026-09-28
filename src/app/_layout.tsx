import { useEffect } from "react";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useFonts } from "expo-font";
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold } from "@expo-google-fonts/inter";
import { Poppins_700Bold, Poppins_800ExtraBold } from "@expo-google-fonts/poppins";
import { GoogleSans_500Medium } from "@expo-google-fonts/google-sans";
import { initSentry } from "@/lib/sentry";
import { AuthProvider, useAuthSession } from "@/modules/auth";

// Runs once at module load, before the first screen renders.
initSentry();

SplashScreen.preventAutoHideAsync();

// Wraps the app in the single shared auth listener before anything below
// (including the route guard, which needs it) can read the session.
export default function RootLayout() {
  return (
    <AuthProvider>
      <RootNavigator />
    </AuthProvider>
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
      </Stack.Protected>
      <Stack.Protected guard={!session}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
      <Stack.Screen name="debug" />
    </Stack>
  );
}

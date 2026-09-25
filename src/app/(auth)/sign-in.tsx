import { useCallback, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { GlassBackdrop } from "@/ui/GlassBackdrop";
import { colors } from "@/ui/tokens";
import { GoogleSignInButton, signInWithGoogle } from "@/modules/auth";
import { Sentry } from "@/lib/sentry";

type Status = { state: "idle" } | { state: "signing-in" } | { state: "error" };

/**
 * (auth)/sign-in — DESIGN.md "Build 5 — Sign-in screen". The root layout's
 * route guard (src/app/_layout.tsx) only renders this group when there's no
 * session, and swaps to (tabs) the moment `signInWithGoogle` succeeds and
 * Supabase's auth listener fires — this screen itself never navigates.
 */
export default function SignIn() {
  const [status, setStatus] = useState<Status>({ state: "idle" });

  const handlePress = useCallback(async () => {
    setStatus({ state: "signing-in" });
    try {
      await signInWithGoogle();
      // No manual navigation: useAuthSession's onAuthStateChange listener
      // updates the session, and the root layout's guard swaps to (tabs).
    } catch (err) {
      // Same generic error card for cancel, missing Play Services, or a
      // Supabase failure — DESIGN.md says don't branch copy per error type.
      // The real cause still goes to Sentry.
      Sentry.captureException(err);
      setStatus({ state: "error" });
    }
  }, []);

  const isSigningIn = status.state === "signing-in";

  return (
    <View style={styles.root}>
      <GlassBackdrop blobs={["purple", "gold"]} opacity={0.28} />
      <SafeAreaView style={[styles.content, isSigningIn && styles.dimmed]}>
        <Text style={styles.wordmark}>🦉 perchable</Text>
        <Text style={styles.tagline}>{"Track what you watch.\nRate it your way."}</Text>

        <View style={styles.buttonGap}>
          {status.state === "error" && (
            <View style={styles.errorCard}>
              <Text style={styles.errorText}>
                ⚠ Couldn&apos;t sign in. Check your connection and try again.
              </Text>
            </View>
          )}
          <GoogleSignInButton loading={isSigningIn} onPress={handlePress} />
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg.base },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
  },
  dimmed: { opacity: 0.85 },
  wordmark: {
    fontFamily: "Poppins_800ExtraBold",
    fontSize: 38,
    color: colors.accent.gold,
  },
  tagline: {
    marginTop: 12,
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    lineHeight: 21,
    color: colors.text.secondary,
    textAlign: "center",
  },
  buttonGap: {
    marginTop: 56,
    width: "100%",
  },
  errorCard: {
    marginBottom: 16,
    padding: 16,
    borderRadius: 16,
    backgroundColor: "rgba(76,29,149,0.28)",
    borderWidth: 1,
    borderColor: "rgba(255,138,138,0.35)",
  },
  errorText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    lineHeight: 21,
    color: colors.danger,
  },
});

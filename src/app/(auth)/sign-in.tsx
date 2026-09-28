import { useCallback, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { GlassBackdrop } from "@/ui/GlassBackdrop";
import { ErrorCard } from "@/ui/ErrorCard";
import { colors, spacing, type } from "@/ui/tokens";
import { GoogleSignInButton, GoogleSignInCancelledError, signInWithGoogle } from "@/modules/auth";
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
      // A user-initiated cancel isn't a real failure though (Build 5 · Bug 1)
      // — skip the Sentry report for that one case; every other cause still
      // goes to Sentry.
      if (!(err instanceof GoogleSignInCancelledError)) {
        Sentry.captureException(err);
      }
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
            <ErrorCard
              message="⚠ Couldn't sign in. Check your connection and try again."
              style={styles.errorCard}
              textStyle={styles.errorText}
            />
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
    paddingHorizontal: spacing[28],
  },
  dimmed: { opacity: 0.85 },
  wordmark: {
    ...type.hero,
    color: colors.accent.gold,
  },
  tagline: {
    marginTop: spacing[12],
    ...type.body,
    lineHeight: 21,
    color: colors.text.secondary,
    textAlign: "center",
  },
  buttonGap: {
    marginTop: spacing[56],
    width: "100%",
  },
  errorCard: {
    marginBottom: spacing[16],
  },
  errorText: {
    ...type.bodyStrong,
    lineHeight: 21,
  },
});

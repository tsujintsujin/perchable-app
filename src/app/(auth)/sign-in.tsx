import { useCallback, useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { GlassBackdrop } from "@/ui/GlassBackdrop";
import { ErrorCard } from "@/ui/ErrorCard";
import { Toast, useToast } from "@/ui/Toast";
import { colors, spacing, type } from "@/ui/tokens";
import {
  consumeAccountDeleted,
  GoogleSignInButton,
  GoogleSignInCancelledError,
  signInWithGoogle,
} from "@/modules/auth";
import { Sentry } from "@/lib/sentry";

// DESIGN.md "Build 9" copy table: shown once after an account deletion.
const ACCOUNT_DELETED_MESSAGE = "✓ Your account was deleted.";

type Status = { state: "idle" } | { state: "signing-in" } | { state: "error" };

/** Google sign-in screen — the route guard renders it only when signed out. */
export default function SignIn() {
  const [status, setStatus] = useState<Status>({ state: "idle" });
  const { message: toastMessage, show: showToast } = useToast();

  // Announces a just-deleted account once on arrival.
  useEffect(() => {
    if (consumeAccountDeleted()) showToast(ACCOUNT_DELETED_MESSAGE);
  }, [showToast]);

  const handlePress = useCallback(async () => {
    setStatus({ state: "signing-in" });
    try {
      await signInWithGoogle();
      // No manual navigation: useAuthSession's onAuthStateChange listener
      // updates the session, and the root layout's guard swaps to (tabs).
    } catch (err) {
      // Same generic error card for any failure. A user cancelling isn't a
      // real failure, so it's the only cause that skips the Sentry report.
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
      <Toast message={toastMessage} variant="info" />
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

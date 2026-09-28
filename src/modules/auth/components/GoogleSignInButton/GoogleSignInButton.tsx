import { useEffect, useState } from "react";
import { Animated, Easing, Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { radius } from "@/ui/tokens";

type Props = {
  loading?: boolean;
  disabled?: boolean;
  onPress: () => void;
};

// Google's Sign-In branding guidelines, exact values — not app tokens
// (see the component doc comment below).
const googleBrand = {
  buttonBg: "#131314",
  buttonBorder: "#8E918F",
  pressedOverlay: "rgba(255,255,255,0.08)",
  spinnerTrack: "rgba(255,255,255,0.3)",
  spinnerActive: "#fff",
  label: "#E3E3E3",
};
const GOOGLE_LABEL_FONT_SIZE = 14;

/**
 * Google's official dark-theme "Sign in with Google" button — exact colors,
 * logo and copy per Google's branding rules. The colors are a deliberate
 * exception to the app's own token system; the corner radius isn't part of
 * Google's spec, so it still comes from `ui/tokens.ts` (`radius.sm`).
 */
export function GoogleSignInButton({ loading = false, disabled = false, onPress }: Props) {
  // useState (not useRef) for the stable Animated.Value — the React
  // Compiler's exhaustive-deps/refs lint flags reading `.current` during
  // render, since a ref update doesn't trigger a re-render on its own.
  const [spin] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (!loading) return;
    const animation = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 800,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    animation.start();
    return () => animation.stop();
  }, [loading, spin]);

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });
  const isDisabled = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Sign in with Google"
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.button,
        isDisabled && !loading && styles.disabled,
        loading && styles.loadingOpacity,
      ]}
    >
      {({ pressed }) => (
        <>
          {/* Google's permitted press feedback — a translucent white overlay
           * on top of the fill, not a whole-button opacity dip. */}
          {pressed && !isDisabled && <View style={styles.pressedOverlay} pointerEvents="none" />}
          {loading ? (
            <Animated.View style={[styles.spinner, { transform: [{ rotate }] }]} />
          ) : (
            <Image
              source={require("../../../../../assets/images/google-g-logo.png")}
              style={styles.logo}
              contentFit="contain"
            />
          )}
          <Text style={styles.label}>{loading ? "Signing in…" : "Sign in with Google"}</Text>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 48,
    borderRadius: radius.sm,
    backgroundColor: googleBrand.buttonBg,
    borderWidth: 1,
    borderColor: googleBrand.buttonBorder,
    overflow: "hidden",
  },
  pressedOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: googleBrand.pressedOverlay,
    borderRadius: radius.sm,
  },
  disabled: {
    opacity: 0.5,
  },
  loadingOpacity: {
    opacity: 0.7,
  },
  logo: {
    width: 18,
    height: 18,
    marginRight: 10,
  },
  spinner: {
    width: 18,
    height: 18,
    marginRight: 10,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: googleBrand.spinnerTrack,
    borderTopColor: googleBrand.spinnerActive,
  },
  label: {
    color: googleBrand.label,
    fontFamily: "GoogleSans_500Medium",
    fontSize: GOOGLE_LABEL_FONT_SIZE,
    lineHeight: 20,
  },
});

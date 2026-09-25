import { useEffect, useState } from "react";
import { Animated, Easing, Pressable, StyleSheet, Text } from "react-native";
import { Image } from "expo-image";

type Props = {
  loading?: boolean;
  disabled?: boolean;
  onPress: () => void;
};

/**
 * Google's official dark-theme "Sign in with Google" button — exact colors,
 * logo and copy per Google's branding rules (DESIGN.md Build 5 spec). These
 * values are a deliberate exception to the app's own token system (§7) —
 * never pull them from `ui/tokens.ts`, and never restyle this button to
 * match the app's own type family or palette.
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
        pressed && !isDisabled && styles.pressed,
      ]}
    >
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
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 48,
    borderRadius: 12,
    backgroundColor: "#131314",
    borderWidth: 1,
    borderColor: "#8E918F",
  },
  pressed: {
    backgroundColor: "#131314",
    // Google-permitted subtle press overlay, layered via a translucent white
    // background since RN has no separate overlay layer here.
    borderColor: "#8E918F",
    opacity: 0.92,
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
    borderColor: "rgba(255,255,255,0.3)",
    borderTopColor: "#fff",
  },
  label: {
    color: "#E3E3E3",
    fontFamily: "GoogleSans_500Medium",
    fontSize: 14,
    lineHeight: 20,
  },
});

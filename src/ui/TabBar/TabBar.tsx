import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BlurView } from "expo-blur";
import { colors, glass, iconSize, spacing, type } from "@/ui/tokens";

// DESIGN.md §2: one tab per route that exists (today Perch, Quick Add, Profile); Search, Chat and
// Leaderboards add their own entry here as they land.
const TAB_META: Record<string, { icon: string; label: string }> = {
  index: { icon: "🦉", label: "Perch" },
  "quick-add": { icon: "🃏", label: "Quick Add" },
  profile: { icon: "👤", label: "Profile" },
};

type Props = {
  state: { index: number; routes: { key: string; name: string }[] };
  navigation: { navigate: (name: string) => void };
};

/** `glass.nav` tier — real BlurView, rendered once from `(tabs)/_layout.tsx`. */
// ponytail: skips the tabPress/canPreventDefault dance — add back if a later
// tab needs to intercept its own re-selection. iOS-only real blur; Android
// falls back to a flat fill (no BlurTargetView reachable from this API).
export function TabBar({ state, navigation }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.wrapper}>
      {Platform.OS === "ios" ? (
        // BlurView's `tint` blurs the real screen content — no flat layers
        // underneath it.
        <BlurView intensity={glass.nav.blurAmount} tint="dark" style={styles.blurFill} />
      ) : (
        // Opaque base first, then the translucent tint on top of it.
        <>
          <View style={styles.opaqueBase} />
          <View style={styles.tintOverlay} />
        </>
      )}
      <View style={[styles.row, { paddingBottom: insets.bottom }]}>
        {state.routes.map((route, index) => {
          const isFocused = state.index === index;
          const meta = TAB_META[route.name] ?? { icon: "•", label: route.name };

          const onPress = () => {
            if (!isFocused) navigation.navigate(route.name);
          };

          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
              accessibilityLabel={meta.label}
              style={styles.tab}
            >
              <Text style={[styles.icon, isFocused && styles.iconActive]}>{meta.icon}</Text>
              <Text style={[styles.label, isFocused && styles.labelActive]}>{meta.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    borderTopWidth: 1,
    borderTopColor: glass.nav.borderColor,
    overflow: "hidden",
  },
  opaqueBase: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.bg.elevatedFlat,
  },
  tintOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: glass.nav.backgroundColor,
  },
  blurFill: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
  row: { flexDirection: "row", paddingTop: spacing[8] },
  tab: { flex: 1, alignItems: "center", gap: 2 },
  icon: { fontSize: iconSize.tab, opacity: 0.6 },
  iconActive: { opacity: 1 },
  label: { ...type.micro, color: colors.text.secondary },
  labelActive: { color: colors.accent.gold },
});

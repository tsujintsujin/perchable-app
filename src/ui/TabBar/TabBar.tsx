import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BlurView } from "expo-blur";
import { colors, glass, iconSize, spacing, type } from "@/ui/tokens";

// DESIGN.md §2: fixed 5 items (Perch/Search/Chat/Leaderboards/Profile), but
// only routes that exist get a tab — the rest add their own entry here as
// they land.
const TAB_META: Record<string, { icon: string; label: string }> = {
  index: { icon: "🦉", label: "Perch" },
  profile: { icon: "👤", label: "Profile" },
};

type Props = {
  state: { index: number; routes: { key: string; name: string }[] };
  navigation: { navigate: (name: string) => void };
};

/** `glass.nav` tier — real BlurView per DESIGN.md §1.5 (static, one instance
 * per screen). Rendered once from `(tabs)/_layout.tsx`, never per-screen.
 *
 * ponytail: skips the `tabPress` emit/`canPreventDefault` dance the default
 * bottom-tab-bar does — nothing listens for it with only 2 tabs and no
 * scroll-to-top behavior yet. Add it back (and the full
 * `BottomTabBarProps` type import) if a later tab screen needs to
 * intercept its own re-selection.
 *
 * ponytail: real Android blur needs a `BlurTargetView` wrapped around the
 * active tab screen, which isn't reachable from this custom `tabBar` render
 * prop without forking the navigator's layout — so Android uses a flat
 * fallback fill instead (below) and only iOS gets the real BlurView.
 */
export function TabBar({ state, navigation }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.wrapper}>
      {Platform.OS === "ios" ? (
        // BlurView's own `tint` is the whole glass.nav treatment here — it
        // blurs the real screen content behind it, so no separate flat
        // layers underneath (that would just give BlurView a flat color to
        // "blur", not real content).
        <BlurView intensity={glass.nav.blurAmount} tint="dark" style={styles.blurFill} />
      ) : (
        // Android: opaque base first, then the translucent glass.nav tint
        // on top — without the opaque base the translucent tint composites
        // against whatever's behind the tab bar's own layout area, not the
        // screen content.
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

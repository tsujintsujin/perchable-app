import { Pressable, StyleSheet, Text, View } from "react-native";
import { BlurView } from "expo-blur";
import { colors, glass } from "@/ui/tokens";

// DESIGN.md §2: fixed 5 items (Perch/Search/Chat/Leaderboards/Profile), but
// only routes that exist get a tab — Search/Chat/Leaderboards land in later
// Builds (17, 27, 29) and each adds its own entry here then.
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
 * ponytail: Android blur needs a `BlurTargetView` wrapped around the
 * content being blurred, with its ref passed to `blurTarget` here
 * (expo-blur docs). That content is the active tab screen, rendered by
 * `<Tabs>` internally — not reachable from this custom `tabBar` render
 * prop without forking the navigator's own layout. `blurMethod` is set so
 * Android 12+ still requests a real blur, but with no `blurTarget` it has
 * nothing to sample, so this currently renders as `glass.nav`'s flat
 * `rgba` fill on Android (visually fine, just not blurred) and a real
 * blur on iOS. Upgrade path: a screen-level `BlurTargetView` wired through
 * `(tabs)/_layout.tsx` once a Build actually needs the Android blur to be
 * real, not just present. */
export function TabBar({ state, navigation }: Props) {
  return (
    <View style={styles.wrapper}>
      <BlurView
        intensity={glass.nav.blurAmount}
        tint="dark"
        blurMethod="dimezisBlurViewSdk31Plus"
        style={styles.blurFill}
      />
      <View style={styles.row}>
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
    // Flat fallback fill behind the BlurView (DESIGN.md §1.5) — same token,
    // so an unblurred render (Android without a wired blurTarget, see
    // above) still looks intentional rather than transparent/broken.
    backgroundColor: glass.nav.backgroundColor,
    borderTopWidth: 1,
    borderTopColor: glass.nav.borderColor,
    overflow: "hidden",
  },
  blurFill: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
  row: { flexDirection: "row", paddingTop: 8, paddingBottom: 24 },
  tab: { flex: 1, alignItems: "center", gap: 2 },
  icon: { fontSize: 20, opacity: 0.6 },
  iconActive: { opacity: 1 },
  label: { fontFamily: "Inter_500Medium", fontSize: 11, color: colors.text.secondary },
  labelActive: { color: colors.accent.gold },
});

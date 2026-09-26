import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
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
 * prop without forking the navigator's own layout. Upgrade path: a
 * screen-level `BlurTargetView` wired through `(tabs)/_layout.tsx` once a
 * Build actually needs the Android blur to be real, not just present.
 *
 * Build 6 · Bug 1: with no `blurTarget` on Android, `expo-blur`'s native
 * view skips its blur setup but still paints the `tint` as its own opaque
 * background — a flat mid-grey, not `glass.nav`'s `rgba` fill underneath
 * (confirmed by pixel sample: rendered `rgb(105,103,108)` instead of
 * `glass.nav` over `bg.base` ≈ `rgb(25,22,31)`). So `BlurView` only renders
 * on iOS here.
 *
 * Also found while re-checking this fix (pixel sample again, not just
 * reasoning): `glass.nav.backgroundColor` alone is a *translucent* rgba —
 * with no BlurView and nothing dark drawn behind the tab bar's own reserved
 * area (Android Tabs lays it out beside the screen content, not on top of
 * it), the translucent fill composites against the native window's own
 * default background instead of `bg.base`, landing near
 * `rgb(125,123,130)` — a different wrong grey, not the fix. `styles.opaqueBase`
 * below adds `bg.elevatedFlat` as the actual opaque backdrop underneath
 * the translucent tint, matching tokens.ts's own note that
 * `bg.elevatedFlat` is "the flat-fallback base color these translucent
 * fills sit on". */
export function TabBar({ state, navigation }: Props) {
  return (
    <View style={styles.wrapper}>
      {Platform.OS === "ios" ? (
        // BlurView's own `tint` is the whole glass.nav treatment here — it
        // blurs the real screen content behind it, so no separate flat
        // layers underneath (that would just give BlurView a flat color to
        // "blur", not real content).
        <BlurView intensity={glass.nav.blurAmount} tint="dark" style={styles.blurFill} />
      ) : (
        // Android: opaque base first (paint order matters — a later sibling
        // draws over an earlier one), then the translucent glass.nav tint on
        // top of it. Without the opaque base, the translucent tint
        // composites against whatever's behind the tab bar's own reserved
        // layout area (not the screen content), landing on the wrong grey —
        // see the comment above.
        <>
          <View style={styles.opaqueBase} />
          <View style={styles.tintOverlay} />
        </>
      )}
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
  row: { flexDirection: "row", paddingTop: 8, paddingBottom: 24 },
  tab: { flex: 1, alignItems: "center", gap: 2 },
  icon: { fontSize: 20, opacity: 0.6 },
  iconActive: { opacity: 1 },
  label: { fontFamily: "Inter_500Medium", fontSize: 11, color: colors.text.secondary },
  labelActive: { color: colors.accent.gold },
});

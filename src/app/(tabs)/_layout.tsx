import { Tabs } from "expo-router";
import { TabBar } from "@/ui/TabBar";

/**
 * DESIGN.md §2's `TabBar` is a fixed 5-item spec (Perch/Search/Chat/
 * Leaderboards/Profile), but only routes that exist get a tab — Build 6
 * adds the second one (Profile); Search/Chat/Leaderboards land in Builds
 * 17, 27, 29 and each adds its own entry to `ui/TabBar`'s TAB_META then.
 * This was flagged as a deferred decision in Build 5's log; this is that
 * Build.
 */
export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <TabBar state={props.state} navigation={props.navigation} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}

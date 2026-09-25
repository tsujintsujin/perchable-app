import { Tabs } from "expo-router";

/**
 * Minimal tabs shell — only "index" (Home) exists as of Build 5. DESIGN.md's
 * §2 `TabBar` (5 items: Perch/Search/Chat/Leaderboards/Profile) waits until
 * the other 4 tab screens exist (Builds 12, 17, 27, current index already
 * covers Profile-adjacent content later); building it now against 4 routes
 * that don't exist yet would be speculative. Default tab bar, hidden since
 * there's nothing to switch between yet.
 */
export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: { display: "none" },
      }}
    />
  );
}

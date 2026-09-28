import { Tabs } from "expo-router";
import { TabBar } from "@/ui/TabBar";

/**
 * Renders a tab for each route that exists. `ui/TabBar`'s 5-item spec fills
 * in as the remaining routes (Search/Chat/Leaderboards) land.
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

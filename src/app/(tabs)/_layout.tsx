import { Tabs } from "expo-router";
import { TabBar } from "@/ui/TabBar";

/** Renders a tab for each route that exists; the rest fill in as they land. */
export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <TabBar state={props.state} navigation={props.navigation} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="quick-add" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}

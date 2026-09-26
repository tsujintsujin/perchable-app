import { Stack } from "expo-router";

/**
 * Nests index/edit/settings inside one "profile" tab. Without this file,
 * Expo Router's `<Tabs>` treats every file directly under `profile/` as its
 * own flat top-level tab (confirmed on-device: it rendered 4 tabs — Perch,
 * profile/index, profile/edit, profile/settings — with the default React
 * Navigation tab bar, not `ui/TabBar`). This Stack is what makes the parent
 * `(tabs)/_layout.tsx` see a single "profile" route to render one tab for.
 */
export default function ProfileLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}

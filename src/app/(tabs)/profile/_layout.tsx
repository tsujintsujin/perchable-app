import { Stack } from "expo-router";

/**
 * Nests index/edit/settings under one "profile" tab. Without this Stack,
 * Expo Router's `<Tabs>` treats every file directly under `profile/` as its
 * own flat top-level tab.
 */
export default function ProfileLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}

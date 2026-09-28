import { Stack } from "expo-router";

/** Nests index/edit/settings under one "profile" tab instead of one each. */
export default function ProfileLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}

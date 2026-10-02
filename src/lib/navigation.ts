import { router } from "expo-router";

/** Leaves a pushed screen: back when there is history, otherwise (cold deep link) Home. */
export function goBackOrHome() {
  if (router.canGoBack()) router.back();
  else router.replace("/");
}

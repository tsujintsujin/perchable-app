import { router } from "expo-router";
import { useTapGuard } from "@/lib/useTapGuard";

// Pushes the Quick Add deck.
function pushQuickAdd() {
  router.push("/quick-add");
}

/** Returns `openQuickAdd()`, which pushes the deck once per tap burst; coming back to the screen re-arms it. */
export function useOpenQuickAdd() {
  return useTapGuard(pushQuickAdd);
}

import { router } from "expo-router";
import { useTapGuard } from "@/lib/useTapGuard";

// Pushes the details screen for a movie.
function pushMovie(id: number) {
  router.push({ pathname: "/movie/[id]", params: { id: String(id) } });
}

/** Returns `openMovie(id)`, which pushes the details screen once per tap burst; coming back to the screen re-arms it. */
export function useOpenMovie() {
  return useTapGuard(pushMovie);
}

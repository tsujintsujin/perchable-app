import { Stack } from "expo-router";
import { initSentry } from "@/lib/sentry";

// Runs once at module load, before the first screen renders.
initSentry();

export default function RootLayout() {
  return <Stack />;
}

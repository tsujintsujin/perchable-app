import * as Sentry from "@sentry/react-native";

const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;

if (!dsn) {
  throw new Error("Missing EXPO_PUBLIC_SENTRY_DSN — check .env");
}

/** Call once from the root layout, before anything else renders. */
export function initSentry() {
  Sentry.init({
    dsn,
    // No user flows worth tracing yet, and this app never sends PII — keep
    // tracing off.
    tracesSampleRate: 0,
    // Send in dev too — there's no separate prod build yet.
    enabled: true,
    // Tags events by build type so dev and prod errors don't land in one
    // undistinguishable stream. __DEV__ is Metro's dev/release flag.
    environment: __DEV__ ? "development" : "production",
  });
}

export { Sentry };

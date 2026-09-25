import * as Sentry from "@sentry/react-native";

const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;

if (!dsn) {
  throw new Error("Missing EXPO_PUBLIC_SENTRY_DSN — check .env");
}

/** Call once from the root layout, before anything else renders. */
export function initSentry() {
  Sentry.init({
    dsn,
    // Foundation module has no user flows yet to trace, and this app never
    // sends PII — keep tracing off rather than sampling something with
    // nothing worth tracing yet. Revisit once real screens exist.
    tracesSampleRate: 0,
    // Send in dev too: Build 4's done-means is a dev-only test button whose
    // event must reach the dashboard, and there's no separate prod build yet.
    enabled: true,
    // No SENTRY_AUTH_TOKEN available yet (Manager hasn't created one) — skip
    // source map upload rather than fail the build. See logs/build-04-testing-sentry.md
    // for the SENTRY_DISABLE_AUTO_UPLOAD=true env var this relies on (also a
    // no-op for debug builds, which never run the upload task at all).
  });
}

export { Sentry };

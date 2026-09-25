import { useCallback, useState } from "react";
import { ActivityIndicator, Button, StyleSheet, Text, View } from "react-native";
import { supabaseAnonKey, supabaseUrl } from "@/lib/supabase";
import { getPopularMovies, type Movie } from "@/modules/movies";
import { Sentry } from "@/lib/sentry";

// Importing from "@/lib/supabase" above runs its module-level check that
// throws if the env vars are missing, so getting this far already proves
// they were read. Reuse the same values instead of re-reading process.env.
const SUPABASE_URL = supabaseUrl;
const SUPABASE_KEY = supabaseAnonKey;

type Status =
  | { state: "idle" }
  | { state: "checking" }
  | { state: "connected" }
  | { state: "error"; message: string };

/** Round-trips to Supabase's auth settings endpoint — no table needed, so it
 * works before any schema exists and isn't blocked by RLS (which only
 * guards table data, not this endpoint). Proves the URL + anon key are both
 * valid: a bad URL fails to resolve/connect, a bad key gets a 401. */
async function pingSupabase(url: string, apikey: string) {
  const response = await fetch(`${url}/auth/v1/settings`, {
    headers: { apikey },
  });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`HTTP ${response.status}: ${body || response.statusText}`);
  }
}

type TmdbStatus =
  | { state: "idle" }
  | { state: "loading" }
  | { state: "loaded"; movies: Movie[]; attribution: string }
  | { state: "error"; message: string };

type SentryStatus =
  | { state: "idle" }
  | { state: "sent"; eventId: string; sentAt: string };

export default function Debug() {
  const [status, setStatus] = useState<Status>({ state: "idle" });
  const [tmdbStatus, setTmdbStatus] = useState<TmdbStatus>({ state: "idle" });
  const [sentryStatus, setSentryStatus] = useState<SentryStatus>({ state: "idle" });

  const sendTestError = useCallback(() => {
    let eventId: string;
    try {
      throw new Error("Perchable Build 4 test error — debug screen button");
    } catch (err) {
      eventId = Sentry.captureException(err);
    }
    setSentryStatus({ state: "sent", eventId, sentAt: new Date().toISOString() });
  }, []);

  const runTmdbCheck = useCallback(async () => {
    setTmdbStatus({ state: "loading" });
    try {
      const { results, attribution } = await getPopularMovies();
      setTmdbStatus({ state: "loaded", movies: results.slice(0, 5), attribution });
    } catch (err) {
      setTmdbStatus({
        state: "error",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }, []);

  const runCheck = useCallback(async (useBadKey: boolean) => {
    if (!SUPABASE_URL || !SUPABASE_KEY) {
      setStatus({ state: "error", message: "Missing Supabase env vars" });
      return;
    }
    setStatus({ state: "checking" });
    try {
      // Test-only override for the failure path — never edits .env.
      await pingSupabase(SUPABASE_URL, useBadKey ? "sb_publishable_invalid_test_key" : SUPABASE_KEY);
      setStatus({ state: "connected" });
    } catch (err) {
      setStatus({
        state: "error",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }, []);

  if (!__DEV__) {
    return (
      <View style={styles.container}>
        <Text>Not available in production builds.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Supabase debug</Text>

      {status.state === "checking" && <ActivityIndicator />}
      {status.state === "connected" && (
        <Text style={styles.ok}>Supabase: connected</Text>
      )}
      {status.state === "error" && (
        <Text style={styles.err}>Supabase: error — {status.message}</Text>
      )}
      {status.state === "idle" && <Text>Supabase: not checked yet</Text>}

      <View style={styles.buttons}>
        <Button title="Check connection" onPress={() => runCheck(false)} />
        <Button title="Simulate bad key (test)" onPress={() => runCheck(true)} />
      </View>

      <Text style={styles.title}>TMDB proxy debug</Text>
      <Button title="Fetch popular movies" onPress={runTmdbCheck} />

      {tmdbStatus.state === "loading" && <ActivityIndicator />}
      {tmdbStatus.state === "error" && (
        <Text style={styles.err}>TMDB: error — {tmdbStatus.message}</Text>
      )}
      {tmdbStatus.state === "loaded" && (
        <View>
          {tmdbStatus.movies.map((movie) => (
            <Text key={movie.id}>{movie.title}</Text>
          ))}
          <Text style={styles.attribution}>{tmdbStatus.attribution}</Text>
        </View>
      )}
      {tmdbStatus.state === "idle" && <Text>TMDB: not checked yet</Text>}

      <Text style={styles.title}>Sentry debug</Text>
      <Button title="Send test error to Sentry" onPress={sendTestError} />
      {sentryStatus.state === "sent" && (
        <Text style={styles.ok}>
          Sent — event {sentryStatus.eventId} at {sentryStatus.sentAt}
        </Text>
      )}
      {sentryStatus.state === "idle" && <Text>Sentry: no test error sent yet</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    padding: 24,
  },
  title: { fontSize: 18, fontWeight: "600" },
  ok: { color: "green", fontSize: 16 },
  err: { color: "red", fontSize: 14, textAlign: "center" },
  buttons: { gap: 12, marginTop: 16 },
  attribution: { color: "gray", fontSize: 11, marginTop: 8, textAlign: "center" },
});

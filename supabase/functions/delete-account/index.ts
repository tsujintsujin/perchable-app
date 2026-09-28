// Deletes the caller's own account — the only place the service-role
// privilege (auth.admin.deleteUser) is used. Storage cleanup runs before
// the auth user is deleted, so a retry after a partial failure is safe.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) {
    return json({ error: "Unauthorized" }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    console.error("delete-account: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set");
    return json({ error: "Server misconfiguration" }, 500);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey);

  // Resolve the caller from their own token — never trust a body-supplied id.
  const { data: userData, error: getUserError } = await admin.auth.getUser(token);
  if (getUserError || !userData?.user) {
    return json({ error: "Unauthorized" }, 401);
  }
  const uid = userData.user.id;

  try {
    // 1) Remove every object under avatars/<uid>/ via the Storage API —
    // listing an already-empty folder is a safe no-op, so this can retry.
    const { data: files, error: listError } = await admin.storage
      .from("avatars")
      .list(uid);
    if (listError) {
      throw new Error(`storage list failed: ${listError.message}`);
    }
    if (files && files.length > 0) {
      const paths = files.map((f) => `${uid}/${f.name}`);
      const { error: removeError } = await admin.storage.from("avatars").remove(paths);
      if (removeError) {
        throw new Error(`storage remove failed: ${removeError.message}`);
      }
    }

    // 2) Delete the auth user. The profiles row cascades (ON DELETE
    // CASCADE). A retry after a partial failure fails with "not found" —
    // treated as success, since the end state matches what was asked for.
    const { error: deleteUserError } = await admin.auth.admin.deleteUser(uid);
    if (deleteUserError && !/not.?found/i.test(deleteUserError.message)) {
      throw new Error(`deleteUser failed: ${deleteUserError.message}`);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`delete-account failed for uid ${uid}:`, message);
    return json({ error: "Account deletion failed" }, 500);
  }

  return json({ ok: true });
});

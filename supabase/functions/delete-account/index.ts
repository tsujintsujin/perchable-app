// Supabase Edge Function: delete the caller's own account.
//
// Deleting a user is a service-role-only operation (auth.admin.deleteUser),
// so it can't happen from the app directly. This function is the only
// place that privilege is used, and only for the caller's own account,
// resolved via `auth.getUser(token)` — never trusting a body-supplied id.
//
// Storage objects are removed before the auth user, so a retry after a
// partial failure is safe: an already-emptied folder lists as empty
// (no-op), and deleting an already-deleted uid fails safely too.

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
    // 1) Remove every object under avatars/<uid>/ — direct SQL deletes on
    // storage.objects are blocked (storage.protect_delete), so this has to
    // go through the Storage API. list() on a folder that's already empty
    // (or was never created — e.g. the user never uploaded a photo)
    // returns an empty array, so this is safe to retry.
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

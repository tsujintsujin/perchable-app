// Storage cleanup for delete-account, kept free of Deno APIs so Jest can test it.

/** Objects returned per list call; explicit because the Storage default is 100 too. */
export const LIST_PAGE_SIZE = 100;

/** Upper bound on list/remove rounds, so a stuck folder fails instead of looping forever. */
const MAX_ROUNDS = 100;

type StorageError = { message: string } | null;

/** The slice of a Supabase Storage bucket client that the cleanup uses. */
export type Bucket = {
  list(
    path: string,
    options: { limit: number; offset: number },
  ): Promise<{ data: { name: string }[] | null; error: StorageError }>;
  remove(paths: string[]): Promise<{ error: StorageError }>;
};

/** Removes every object directly under `<folder>/`, repeating until the folder lists empty. */
export async function emptyFolder(bucket: Bucket, folder: string): Promise<void> {
  for (let round = 0; round < MAX_ROUNDS; round++) {
    // Offset stays 0: removed objects drop out, so the next page is always the first.
    const { data, error } = await bucket.list(folder, { limit: LIST_PAGE_SIZE, offset: 0 });
    if (error) throw new Error(`storage list failed: ${error.message}`);
    if (!data || data.length === 0) return;

    const { error: removeError } = await bucket.remove(data.map((f) => `${folder}/${f.name}`));
    if (removeError) throw new Error(`storage remove failed: ${removeError.message}`);
  }
  throw new Error("storage cleanup did not finish");
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Reads the `sub` claim from a JWT payload without verifying it; null unless it is a UUID.
 * Only safe because verify_jwt has already checked the signature and expiry. */
export function subFromJwt(token: string): string | null {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const claims = JSON.parse(atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "=")));
    return typeof claims.sub === "string" && UUID_PATTERN.test(claims.sub) ? claims.sub : null;
  } catch {
    return null;
  }
}

/** True only when a getUserById result proves the user does not exist (not for other errors). */
export function isUserGone(result: {
  data: { user: unknown } | null;
  error: { message: string; status?: number; code?: string } | null;
}): boolean {
  const { data, error } = result;
  if (data?.user || !error) return false;
  return error.status === 404 || error.code === "user_not_found" || /not.?found/i.test(error.message);
}

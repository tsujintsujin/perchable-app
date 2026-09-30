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

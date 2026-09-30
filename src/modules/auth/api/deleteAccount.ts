import { FunctionsFetchError, FunctionsHttpError } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

/** The request never reached the server (offline or unreachable); nothing was deleted. */
export class DeleteAccountOfflineError extends Error {
  constructor() {
    super("Network request failed");
    this.name = "DeleteAccountOfflineError";
  }
}

/** Asks the delete-account Edge Function to delete the caller. Resolves when the account is gone. */
export async function deleteAccount(): Promise<void> {
  const { error } = await supabase.functions.invoke("delete-account");
  if (!error) return;
  // 401 means the token's user no longer exists, so a previous attempt already finished.
  if (error instanceof FunctionsHttpError && error.context?.status === 401) return;
  if (error instanceof FunctionsFetchError) throw new DeleteAccountOfflineError();
  throw error;
}

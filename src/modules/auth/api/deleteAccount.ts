import { FunctionsFetchError } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { authReady } from "@/lib/requestTimeout";

/** The request never reached the server (offline or unreachable); nothing was deleted. */
export class DeleteAccountOfflineError extends Error {
  constructor() {
    super("Network request failed");
    this.name = "DeleteAccountOfflineError";
  }
}

/** Asks the delete-account Edge Function to delete the caller. Resolves when the account is gone. */
export async function deleteAccount(): Promise<void> {
  // Still starting up or refreshing offline: nothing was sent, so nothing was deleted.
  await authReady().catch(() => {
    throw new DeleteAccountOfflineError();
  });
  const { error } = await supabase.functions.invoke("delete-account");
  if (!error) return;
  if (error instanceof FunctionsFetchError) throw new DeleteAccountOfflineError();
  throw error;
}

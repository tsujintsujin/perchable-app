// Module-level flag: the auth gate (not a router call) moves the user to sign-in,
// so a route param can't carry "the account was just deleted" across the redirect.
let pending = false;

/** Records that the account was just deleted, for the sign-in screen to announce. */
export function markAccountDeleted(): void {
  pending = true;
}

/** Returns true once after markAccountDeleted, then false until it is marked again. */
export function consumeAccountDeleted(): boolean {
  const was = pending;
  pending = false;
  return was;
}

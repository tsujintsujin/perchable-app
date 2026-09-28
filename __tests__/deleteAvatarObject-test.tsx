/**
 * Build 7 · Bug 1b: `extractOwnAvatarPath` is the whole safety boundary for
 * cleanup deletes — it decides whether a given `avatar_url` is safe to hand
 * to `storage.remove()` at all. Tested directly here (pure function, no
 * mocking needed) since getting this wrong would mean deleting the wrong
 * thing, not just missing a cleanup. `deleteAvatarObject` itself (the async
 * function that actually calls Supabase) is exercised through
 * `edit-profile-test.tsx` instead, mocked at the `@/modules/profile`
 * boundary — the same convention every other api function in this module
 * already uses there, rather than inventing a second mocking style just for
 * this one function.
 */
// deleteAvatarObject.ts also imports `@/lib/supabase` (for the function
// these tests don't exercise) and `@/lib/supabase` itself imports
// AsyncStorage, which isn't available in Jest without a real device —
// stubbed here purely so the module can load; same pattern sign-in-test.tsx
// already uses for the same reason.
jest.mock("@/lib/supabase", () => ({ supabase: {} }));
jest.mock("@/lib/sentry", () => ({ Sentry: { captureException: jest.fn() } }));

import { extractOwnAvatarPath } from "@/modules/profile/api/deleteAvatarObject";

const UID = "5d77892a-383a-4ffc-b587-8f17697f8245";
const OTHER_UID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";

describe("extractOwnAvatarPath", () => {
  it("extracts the path from a normal own-avatar public URL", () => {
    const url = `https://vpcuornksvqziqzzpiwq.supabase.co/storage/v1/object/public/avatars/${UID}/avatar-123.jpg`;
    expect(extractOwnAvatarPath(url, UID)).toBe(`${UID}/avatar-123.jpg`);
  });

  it("strips a query string (old cache-bust-style URLs)", () => {
    const url = `https://vpcuornksvqziqzzpiwq.supabase.co/storage/v1/object/public/avatars/${UID}/avatar.jpg?v=1700000000000`;
    expect(extractOwnAvatarPath(url, UID)).toBe(`${UID}/avatar.jpg`);
  });

  it("returns null for a Google-provided avatar URL (no avatars-bucket path at all)", () => {
    const url = "https://lh3.googleusercontent.com/a/some-google-photo=s96-c";
    expect(extractOwnAvatarPath(url, UID)).toBeNull();
  });

  it("returns null for another user's avatar path", () => {
    const url = `https://vpcuornksvqziqzzpiwq.supabase.co/storage/v1/object/public/avatars/${OTHER_UID}/avatar-123.jpg`;
    expect(extractOwnAvatarPath(url, UID)).toBeNull();
  });

  it("returns null for a URL from a different bucket", () => {
    const url = `https://vpcuornksvqziqzzpiwq.supabase.co/storage/v1/object/public/posters/${UID}/poster.jpg`;
    expect(extractOwnAvatarPath(url, UID)).toBeNull();
  });
});

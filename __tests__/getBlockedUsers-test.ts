const mockFrom = jest.fn();
jest.mock("@/lib/supabase", () => ({ supabase: { auth: { getSession: () => Promise.resolve({}) }, from: (...args: unknown[]) => mockFrom(...args) } }));
jest.mock("@/lib/sentry", () => ({ Sentry: { captureException: jest.fn() } }));

import { getBlockedUsers } from "@/modules/moderation/api/getBlockedUsers";

describe("getBlockedUsers", () => {
  it("reads the caller's blocks, then the profiles by id, and keeps block order with fallbacks for a missing profile", async () => {
    const order = jest.fn().mockResolvedValue({ data: [{ blocked_id: "t" }, { blocked_id: "gone" }, { blocked_id: "m" }], error: null });
    const eqBlocker = jest.fn().mockReturnValue({ order });
    const inIds = jest.fn().mockResolvedValue({
      data: [
        { id: "m", display_name: "Maya", avatar_url: "u", usertag: "maya" },
        { id: "t", display_name: null, avatar_url: null, usertag: null },
      ],
      error: null,
    });
    mockFrom.mockImplementation((table: string) =>
      table === "blocked_users"
        ? { select: () => ({ eq: eqBlocker }) }
        : { select: () => ({ in: inIds }) },
    );

    const users = await getBlockedUsers("me");
    expect(eqBlocker).toHaveBeenCalledWith("blocker_id", "me");
    expect(inIds).toHaveBeenCalledWith("id", ["t", "gone", "m"]);
    expect(users).toEqual([
      { id: "t", displayName: null, avatarUrl: null, usertag: null },
      { id: "gone", displayName: null, avatarUrl: null, usertag: null },
      { id: "m", displayName: "Maya", avatarUrl: "u", usertag: "maya" },
    ]);
  });

  it("makes no profiles read when there are no blocks", async () => {
    const order = jest.fn().mockResolvedValue({ data: [], error: null });
    mockFrom.mockReset().mockReturnValue({ select: () => ({ eq: () => ({ order }) }) });
    expect(await getBlockedUsers("me")).toEqual([]);
    expect(mockFrom).toHaveBeenCalledTimes(1);
  });

  it("throws when either read fails", async () => {
    const error = { code: "42501", message: "denied" };
    mockFrom.mockReset().mockReturnValue({ select: () => ({ eq: () => ({ order: () => Promise.resolve({ data: null, error }) }) }) });
    await expect(getBlockedUsers("me")).rejects.toBe(error);
  });
});

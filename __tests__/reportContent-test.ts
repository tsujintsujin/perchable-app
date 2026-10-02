const mockInsert = jest.fn();
const mockFrom = jest.fn();
jest.mock("@/lib/supabase", () => ({ supabase: { auth: { getSession: () => Promise.resolve({}) }, from: (...args: unknown[]) => mockFrom(...args) } }));
jest.mock("@/lib/sentry", () => ({ Sentry: { captureException: jest.fn() } }));

import { blockUser, unblockUser } from "@/modules/moderation/api/blockUser";
import { reportContent } from "@/modules/moderation/api/reportContent";

const TARGET = { type: "comment", id: "c1", ownerId: "u2" } as const;

describe("moderation api inserts", () => {
  beforeEach(() => {
    mockInsert.mockReset().mockResolvedValue({ error: null });
    // The returned table object has insert only: chaining .select() or .upsert() would throw.
    mockFrom.mockReset().mockReturnValue({ insert: mockInsert });
  });

  it("reportContent is one bare insert into reports, with no .select() or .upsert()", async () => {
    await reportContent(TARGET, "other", "spam link");
    expect(mockFrom).toHaveBeenCalledWith("reports");
    expect(mockInsert).toHaveBeenCalledTimes(1);
    expect(mockInsert).toHaveBeenCalledWith({
      target_type: "comment",
      target_id: "c1",
      reported_user_id: "u2",
      reason: "other",
      details: "spam link",
    });
  });

  it("reportContent throws the Supabase error", async () => {
    const error = { code: "42501", message: "denied" };
    mockInsert.mockResolvedValue({ error });
    await expect(reportContent(TARGET, "spam", null)).rejects.toBe(error);
  });

  it("blockUser is one bare insert into blocked_users, with no .select() or .upsert()", async () => {
    await blockUser("me", "u2");
    expect(mockFrom).toHaveBeenCalledWith("blocked_users");
    expect(mockInsert).toHaveBeenCalledWith({ blocker_id: "me", blocked_id: "u2" });
  });

  it("unblockUser deletes only the caller's row for that user", async () => {
    const eqSecond = jest.fn().mockResolvedValue({ error: null });
    const eqFirst = jest.fn().mockReturnValue({ eq: eqSecond });
    mockFrom.mockReturnValue({ delete: () => ({ eq: eqFirst }) });
    await unblockUser("me", "u2");
    expect(eqFirst).toHaveBeenCalledWith("blocker_id", "me");
    expect(eqSecond).toHaveBeenCalledWith("blocked_id", "u2");
  });
});

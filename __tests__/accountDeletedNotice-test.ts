import { clearAccountDeleted, consumeAccountDeleted, markAccountDeleted } from "@/modules/auth/accountDeletedNotice";

describe("accountDeletedNotice", () => {
  it("is false until marked, true exactly once after, then false again", () => {
    expect(consumeAccountDeleted()).toBe(false);
    markAccountDeleted();
    expect(consumeAccountDeleted()).toBe(true);
    expect(consumeAccountDeleted()).toBe(false);
  });

  it("is withdrawn by clearAccountDeleted", () => {
    markAccountDeleted();
    clearAccountDeleted();
    expect(consumeAccountDeleted()).toBe(false);
  });
});

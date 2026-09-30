import { emptyFolder, LIST_PAGE_SIZE, type Bucket } from "../supabase/functions/delete-account/cleanup";

/** In-memory bucket: list pages by limit/offset like Storage; remove drops objects. */
function fakeBucket(count: number, overrides: Partial<Bucket> = {}) {
  let names = Array.from({ length: count }, (_, i) => `file-${i}.jpg`);
  const list = jest.fn(async (_path: string, opts: { limit: number; offset: number }) => ({
    data: names.slice(opts.offset, opts.offset + opts.limit).map((name) => ({ name })),
    error: null,
  }));
  const remove = jest.fn(async (paths: string[]) => {
    const gone = new Set(paths.map((p) => p.split("/")[1]));
    names = names.filter((n) => !gone.has(n));
    return { error: null };
  });
  return { bucket: { list, remove, ...overrides } as Bucket, list, remove, remaining: () => names.length };
}

describe("emptyFolder", () => {
  it("does nothing for an empty folder", async () => {
    const { bucket, remove } = fakeBucket(0);
    await emptyFolder(bucket, "uid-1");
    expect(remove).not.toHaveBeenCalled();
  });

  it("removes a single object by its full path", async () => {
    const { bucket, remove, remaining } = fakeBucket(1);
    await emptyFolder(bucket, "uid-1");
    expect(remove).toHaveBeenCalledWith(["uid-1/file-0.jpg"]);
    expect(remaining()).toBe(0);
  });

  it("loops past one page until the folder is empty", async () => {
    const { bucket, list, remaining } = fakeBucket(LIST_PAGE_SIZE * 2 + 5);
    await emptyFolder(bucket, "uid-1");
    expect(remaining()).toBe(0);
    // Three pages of work plus the final empty listing.
    expect(list).toHaveBeenCalledTimes(4);
    expect(list).toHaveBeenCalledWith("uid-1", { limit: LIST_PAGE_SIZE, offset: 0 });
  });

  it("throws on a list error", async () => {
    const { bucket } = fakeBucket(1, {
      list: async () => ({ data: null, error: { message: "boom" } }),
    });
    await expect(emptyFolder(bucket, "uid-1")).rejects.toThrow("storage list failed: boom");
  });

  it("throws on a remove error", async () => {
    const { bucket } = fakeBucket(1, { remove: async () => ({ error: { message: "nope" } }) });
    await expect(emptyFolder(bucket, "uid-1")).rejects.toThrow("storage remove failed: nope");
  });

  it("gives up instead of looping forever when removal does not shrink the folder", async () => {
    const { bucket, list } = fakeBucket(1, { remove: async () => ({ error: null }) });
    await expect(emptyFolder(bucket, "uid-1")).rejects.toThrow("did not finish");
    expect(list.mock.calls.length).toBeLessThanOrEqual(100);
  });
});

import { renderHook } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  MAX_SKIPS,
  capSkips,
  clearQuickAddData,
  getSessionAdds,
  loadSkips,
  saveSkips,
  setSessionAdds,
  useClearQuickAddOnSignOut,
} from "@/modules/quick-add/skipMemory";

type Props = { id: string | undefined };
const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>;
const renderSignOutHook = (id: string | undefined) =>
  renderHook(({ id: current }: Props) => useClearQuickAddOnSignOut(current), { initialProps: { id }, wrapper });

// Spies made by a test, restored by hand: restoreAllMocks would also wipe the AsyncStorage mock's own implementations.
const spies: jest.SpyInstance[] = [];
afterEach(() => spies.splice(0).forEach((spy) => spy.mockRestore()));

beforeEach(async () => {
  await AsyncStorage.clear();
  for (const id of ["u1", "u2"]) await clearQuickAddData(id);
});

describe("skip memory", () => {
  it("saves and loads one key per user, holding only movie ids", async () => {
    await saveSkips("u1", [1, 2, 3]);
    await saveSkips("u2", [9]);
    expect(await AsyncStorage.getItem("quickAdd:skips:u1")).toBe("[1,2,3]");
    expect(await AsyncStorage.getItem("quickAdd:skips:u2")).toBe("[9]");
    expect(await loadSkips("u1")).toEqual([1, 2, 3]);
  });

  it("never reads another user key", async () => {
    await saveSkips("u2", [9]);
    expect(await loadSkips("u1")).toEqual([]);
  });

  it("drops the oldest ids past 5,000", async () => {
    const ids = Array.from({ length: MAX_SKIPS + 3 }, (_, i) => i + 1);
    expect(capSkips(ids)).toHaveLength(MAX_SKIPS);
    expect(capSkips(ids)[0]).toBe(4);
    await saveSkips("u1", ids);
    const stored = await loadSkips("u1");
    expect(stored).toHaveLength(MAX_SKIPS);
    expect(stored[MAX_SKIPS - 1]).toBe(MAX_SKIPS + 3);
  });

  it("treats a failed read as empty and never throws", async () => {
    spies.push(jest.spyOn(AsyncStorage, "getItem").mockRejectedValue(new Error("disk")));
    expect(await loadSkips("u1")).toEqual([]);
  });

  it.each([["not json"], ['{"a":1}'], ['"text"'], ["null"]])("treats corrupt content %s as empty", async (raw) => {
    await AsyncStorage.setItem("quickAdd:skips:u1", raw);
    expect(await loadSkips("u1")).toEqual([]);
  });

  it("keeps only whole numbers from a partly corrupt list", async () => {
    await AsyncStorage.setItem("quickAdd:skips:u1", JSON.stringify([1, "x", 2.5, null, 3]));
    expect(await loadSkips("u1")).toEqual([1, 3]);
  });

  it("swallows a failed write", async () => {
    spies.push(jest.spyOn(AsyncStorage, "setItem").mockRejectedValue(new Error("full")));
    await expect(saveSkips("u1", [1])).resolves.toBeUndefined();
  });

  it("keeps rapid writes in order: the last one wins", async () => {
    void saveSkips("u1", [1]);
    void saveSkips("u1", [1, 2]);
    void saveSkips("u1", [1, 2, 3]);
    expect(await loadSkips("u1")).toEqual([1, 2, 3]);
  });

  it("holds the session list per user, outside any screen", () => {
    setSessionAdds("u1", [5, 6]);
    expect(getSessionAdds("u1")).toEqual([5, 6]);
    expect(getSessionAdds("u2")).toEqual([]);
  });
});

describe("clearQuickAddData and the sign-out hook", () => {
  it("removes the user skips and session list, and leaves another user alone", async () => {
    await saveSkips("u1", [1]);
    await saveSkips("u2", [2]);
    setSessionAdds("u1", [7]);
    setSessionAdds("u2", [8]);
    await clearQuickAddData("u1");
    expect(await AsyncStorage.getItem("quickAdd:skips:u1")).toBeNull();
    expect(getSessionAdds("u1")).toEqual([]);
    expect(await loadSkips("u2")).toEqual([2]);
    expect(getSessionAdds("u2")).toEqual([8]);
  });

  it("does nothing at first render, signed in or not", async () => {
    await saveSkips("u1", [1]);
    await renderSignOutHook("u1");
    await renderSignOutHook(undefined);
    expect(await loadSkips("u1")).toEqual([1]);
  });

  it("clears the departing user when the session goes from a user to none", async () => {
    await saveSkips("u1", [1]);
    setSessionAdds("u1", [4]);
    const view = await renderSignOutHook("u1");
    await view.rerender({ id: undefined });
    expect(await loadSkips("u1")).toEqual([]);
    expect(getSessionAdds("u1")).toEqual([]);
  });

  it("does not clear anything when a user signs in (none to a user)", async () => {
    await saveSkips("u1", [1]);
    const view = await renderSignOutHook(undefined);
    await view.rerender({ id: "u1" });
    expect(await loadSkips("u1")).toEqual([1]);
  });

  it("clears the first user when the account changes to someone else, and keeps the new one", async () => {
    await saveSkips("u1", [1]);
    await saveSkips("u2", [2]);
    const view = await renderSignOutHook("u1");
    await view.rerender({ id: "u2" });
    expect(await loadSkips("u1")).toEqual([]);
    expect(await loadSkips("u2")).toEqual([2]);
  });
});

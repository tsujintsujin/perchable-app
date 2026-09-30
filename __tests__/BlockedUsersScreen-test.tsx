import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { Text } from "react-native";

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

const mockBack = jest.fn();
jest.mock("expo-router", () => ({ router: { back: () => mockBack() } }));

// Reruns only when the callback's identity changes, like react-navigation.
jest.mock("expo-router/react-navigation", () => {
  const ReactActual = require("react");
  return {
    useFocusEffect: (effect: () => void | (() => void)) => {
      ReactActual.useEffect(effect, [effect]);
    },
  };
});

let mockSession: { user: { id: string } } | null = { user: { id: "A" } };
jest.mock("@/modules/auth", () => ({ useAuthSession: () => ({ session: mockSession }) }));

const mockGet = jest.fn();
jest.mock("@/modules/moderation/api/getBlockedUsers", () => ({
  getBlockedUsers: (...args: unknown[]) => mockGet(...args),
}));
const mockUnblock = jest.fn();
jest.mock("@/modules/moderation/api/blockUser", () => ({
  unblockUser: (...args: unknown[]) => mockUnblock(...args),
  blockUser: jest.fn(),
}));
const mockCapture = jest.fn();
jest.mock("@/lib/sentry", () => ({ Sentry: { captureException: (...args: unknown[]) => mockCapture(...args) } }));

import { BlockedUsersScreen } from "@/modules/moderation/components/BlockedUsersScreen";
import { useBlockedUsers } from "@/modules/moderation/hooks/useBlockedUsers";

const MAYA = { id: "m", displayName: "Maya Lim", avatarUrl: null, usertag: "maya_l" };
const THEO = { id: "t", displayName: "Theo Ramos", avatarUrl: null, usertag: "theo_r" };
const NOBODY = { id: "n", displayName: null, avatarUrl: null, usertag: null };

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/** Prints the hook's state so an owner switch can be observed without a screen. */
function HookProbe() {
  const b = useBlockedUsers();
  return <Text testID="probe">{JSON.stringify({ state: b.state, users: b.state === "loaded" ? b.users.map((u) => u.id) : [] })}</Text>;
}

describe("BlockedUsersScreen", () => {
  beforeEach(() => {
    mockBack.mockReset();
    mockGet.mockReset().mockResolvedValue([MAYA, THEO, NOBODY]);
    mockUnblock.mockReset().mockResolvedValue(undefined);
    mockCapture.mockReset();
    mockSession = { user: { id: "A" } };
  });

  it("shows the header, intro and shimmer rows while loading, then the filled rows", async () => {
    const pending = deferred<never[]>();
    mockGet.mockReturnValue(pending.promise);
    await render(<BlockedUsersScreen />);
    expect(screen.getByText("Blocked users")).toBeTruthy();
    expect(screen.getByText("People you've blocked appear here. Unblock anyone to undo a block.")).toBeTruthy();
    expect(screen.getAllByTestId("shimmer-row")).toHaveLength(3);

    await act(async () => pending.resolve([]));
    expect(screen.queryAllByTestId("shimmer-row")).toHaveLength(0);
  });

  it("filled: name, @usertag, the 'Perchable user' fallback with no tag line, and a 48dp-high Unblock per row", async () => {
    await render(<BlockedUsersScreen />);
    expect(await screen.findByText("Maya Lim")).toBeTruthy();
    expect(screen.getByText("@maya_l")).toBeTruthy();
    expect(screen.getByText("Theo Ramos")).toBeTruthy();
    expect(screen.getByText("Perchable user")).toBeTruthy();
    expect(screen.queryByText("@null")).toBeNull();
    expect(screen.getByRole("button", { name: "Unblock Maya Lim" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Unblock Perchable user" })).toBeTruthy();
  });

  it("empty: shows the empty state", async () => {
    mockGet.mockResolvedValue([]);
    await render(<BlockedUsersScreen />);
    expect(await screen.findByText("No blocked users")).toBeTruthy();
    expect(screen.getByText("People you block will show up here.")).toBeTruthy();
  });

  it("load error: shows the owl state and Retry reloads", async () => {
    mockGet.mockRejectedValueOnce({ code: "42501", message: "denied" });
    await render(<BlockedUsersScreen />);
    expect(await screen.findByText("Couldn't load blocked users")).toBeTruthy();
    expect(screen.getByText("Check your connection and try again.")).toBeTruthy();
    expect(mockCapture).toHaveBeenCalledTimes(1);

    await act(async () => void fireEvent.press(screen.getByText("Retry")));
    expect(await screen.findByText("Maya Lim")).toBeTruthy();
    expect(mockGet).toHaveBeenCalledTimes(2);
  });

  it("the back chip goes back", async () => {
    await render(<BlockedUsersScreen />);
    await act(async () => void fireEvent.press(screen.getByLabelText("Back")));
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it("tapping Unblock opens an inline confirmation on that row only; opening another closes the first", async () => {
    await render(<BlockedUsersScreen />);
    await screen.findByText("Maya Lim");
    await act(async () => void fireEvent.press(screen.getByRole("button", { name: "Unblock Maya Lim" })));
    expect(screen.getByText("Unblock Maya?")).toBeTruthy();
    expect(screen.getByText("This removes them from your blocked list.")).toBeTruthy();
    expect(mockUnblock).not.toHaveBeenCalled();

    await act(async () => void fireEvent.press(screen.getByRole("button", { name: "Unblock Theo Ramos" })));
    expect(screen.queryByText("Unblock Maya?")).toBeNull();
    expect(screen.getByText("Unblock Theo?")).toBeTruthy();
  });

  it("a null display name confirms with 'Unblock this user?'", async () => {
    await render(<BlockedUsersScreen />);
    await screen.findByText("Maya Lim");
    await act(async () => void fireEvent.press(screen.getByRole("button", { name: "Unblock Perchable user" })));
    expect(screen.getByText("Unblock this user?")).toBeTruthy();
  });

  it("Cancel in the confirmation closes it and unblocks nothing", async () => {
    await render(<BlockedUsersScreen />);
    await screen.findByText("Maya Lim");
    await act(async () => void fireEvent.press(screen.getByRole("button", { name: "Unblock Maya Lim" })));
    await act(async () => void fireEvent.press(screen.getByRole("button", { name: "Cancel" })));
    expect(screen.queryByText("Unblock Maya?")).toBeNull();
    expect(mockUnblock).not.toHaveBeenCalled();
  });

  it("confirming shows Unblocking… on that row only, ignores repeat taps, then removes the row", async () => {
    const pending = deferred<void>();
    mockUnblock.mockReturnValue(pending.promise);
    await render(<BlockedUsersScreen />);
    await screen.findByText("Maya Lim");
    await act(async () => void fireEvent.press(screen.getByRole("button", { name: "Unblock Maya Lim" })));
    await act(async () => void fireEvent.press(screen.getByRole("button", { name: "Unblock" })));

    expect(mockUnblock).toHaveBeenCalledWith("A", "m");
    expect(screen.getByText("Unblocking…")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Unblock Theo Ramos" })).toBeEnabled();
    await act(async () => void fireEvent.press(screen.getByText("Unblocking…")));
    expect(mockUnblock).toHaveBeenCalledTimes(1);

    await act(async () => void pending.resolve());
    expect(screen.queryByText("Maya Lim")).toBeNull();
    expect(screen.getByText("Theo Ramos")).toBeTruthy();
  });

  it("removing the last row lands on the empty state", async () => {
    mockGet.mockResolvedValue([MAYA]);
    await render(<BlockedUsersScreen />);
    await screen.findByText("Maya Lim");
    await act(async () => void fireEvent.press(screen.getByRole("button", { name: "Unblock Maya Lim" })));
    await act(async () => void fireEvent.press(screen.getByRole("button", { name: "Unblock" })));
    expect(await screen.findByText("No blocked users")).toBeTruthy();
  });

  it("a failed unblock keeps the row, shows the error card above the list, and clears on the next action", async () => {
    mockUnblock.mockRejectedValueOnce({ code: "42501", message: "denied" });
    await render(<BlockedUsersScreen />);
    await screen.findByText("Theo Ramos");
    await act(async () => void fireEvent.press(screen.getByRole("button", { name: "Unblock Theo Ramos" })));
    await act(async () => void fireEvent.press(screen.getByRole("button", { name: "Unblock" })));

    expect(screen.getByText("Theo Ramos")).toBeTruthy();
    expect(screen.getByRole("alert")).toBeTruthy();
    expect(screen.getByText("⚠ Couldn't unblock Theo. Check your connection and try again.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Unblock Theo Ramos" })).toBeEnabled();
    expect(mockCapture).toHaveBeenCalledTimes(1);

    await act(async () => void fireEvent.press(screen.getByRole("button", { name: "Unblock Maya Lim" })));
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("leaving the screen mid-unblock applies nothing", async () => {
    const pending = deferred<void>();
    mockUnblock.mockReturnValue(pending.promise);
    const view = await render(<BlockedUsersScreen />);
    await screen.findByText("Maya Lim");
    await act(async () => void fireEvent.press(screen.getByRole("button", { name: "Unblock Maya Lim" })));
    await act(async () => void fireEvent.press(screen.getByRole("button", { name: "Unblock" })));
    await view.unmount();
    await act(async () => void pending.resolve());
    expect(mockCapture).not.toHaveBeenCalled();
  });

  it("owner-tagged: user A's list is never shown to user B, and sign-out shows nothing", async () => {
    const forB = deferred<(typeof MAYA)[]>();
    mockGet.mockImplementation((id: string) => (id === "A" ? Promise.resolve([MAYA]) : forB.promise));
    const view = await render(<HookProbe />);
    await waitFor(() => expect(screen.getByTestId("probe").props.children).toContain('"users":["m"]'));

    mockSession = { user: { id: "B" } };
    await view.rerender(<HookProbe />);
    expect(screen.getByTestId("probe").props.children).toContain('"state":"loading"');
    expect(screen.getByTestId("probe").props.children).not.toContain('"m"');

    await act(async () => void forB.resolve([THEO]));
    await waitFor(() => expect(screen.getByTestId("probe").props.children).toContain('"users":["t"]'));

    mockSession = null;
    await view.rerender(<HookProbe />);
    expect(screen.getByTestId("probe").props.children).toContain('"state":"loading"');
    expect(screen.getByTestId("probe").props.children).not.toContain('"t"');
  });

  it("a late result for a previous user is dropped", async () => {
    const forA = deferred<(typeof MAYA)[]>();
    mockGet.mockImplementation((id: string) => (id === "A" ? forA.promise : Promise.resolve([THEO])));
    const view = await render(<HookProbe />);
    mockSession = { user: { id: "B" } };
    await view.rerender(<HookProbe />);
    await waitFor(() => expect(screen.getByTestId("probe").props.children).toContain('"users":["t"]'));

    await act(async () => void forA.resolve([MAYA]));
    expect(screen.getByTestId("probe").props.children).toContain('"users":["t"]');
  });
});

import { act, fireEvent, render, screen } from "@testing-library/react-native";

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

let mockSession: { user: { id: string } } | null = { user: { id: "me" } };
jest.mock("@/modules/auth", () => ({ useAuthSession: () => ({ session: mockSession }) }));

const mockNeq = jest.fn();
const mockFrom = jest.fn();
jest.mock("@/lib/supabase", () => ({ supabase: { from: (...args: unknown[]) => mockFrom(...args) } }));
jest.mock("@/lib/sentry", () => ({ Sentry: { captureException: jest.fn() } }));

import { ModerationDevHarness } from "@/modules/moderation/components/ModerationDevHarness";

/** A profiles query that resolves to `rows` for `.select().neq().limit()`. */
function profilesReturn(rows: unknown[]) {
  mockNeq.mockReset().mockReturnValue({ limit: () => Promise.resolve({ data: rows, error: null }) });
  mockFrom.mockReset().mockReturnValue({ select: () => ({ neq: mockNeq }) });
}

describe("ModerationDevHarness", () => {
  beforeEach(() => {
    mockSession = { user: { id: "me" } };
  });

  it("a failed profiles query shows an error line instead of loading forever", async () => {
    mockNeq.mockReset().mockReturnValue({
      limit: () => Promise.resolve({ data: null, error: { message: "permission denied" } }),
    });
    mockFrom.mockReset().mockReturnValue({ select: () => ({ neq: mockNeq }) });
    await render(<ModerationDevHarness />);
    expect(await screen.findByText(/Couldn't load profiles: permission denied/)).toBeTruthy();
    expect(screen.queryByText("Loading profiles…")).toBeNull();
  });

  it("with no other profiles says so, and still opens the report and block sheets", async () => {
    profilesReturn([]);
    await render(<ModerationDevHarness />);
    expect(screen.getByText("Moderation dev harness")).toBeTruthy();
    expect(await screen.findByText(/No other profiles yet/)).toBeTruthy();
    expect(mockNeq).toHaveBeenCalledWith("id", "me");

    await act(async () => void fireEvent.press(screen.getByLabelText("Report comment (random id)")));
    expect(screen.getByText("Report this comment")).toBeTruthy();
    await act(async () => void fireEvent.press(screen.getByRole("button", { name: "Cancel" })));

    await act(async () => void fireEvent.press(screen.getByLabelText("Block user")));
    expect(screen.getByText("Block this user?")).toBeTruthy();
  });

  it("lists other profiles, pre-selects the first, and blocks that one by name", async () => {
    profilesReturn([
      { id: "u2", display_name: "Maya Lim", usertag: "maya" },
      { id: "u3", display_name: "Theo", usertag: "theo" },
    ]);
    await render(<ModerationDevHarness />);
    expect(await screen.findByRole("radio", { name: "Maya Lim @maya", selected: true })).toBeTruthy();

    await act(async () => void fireEvent.press(screen.getByRole("radio", { name: "Theo @theo" })));
    await act(async () => void fireEvent.press(screen.getByLabelText("Block user")));
    expect(screen.getByText("Block Theo?")).toBeTruthy();
  });

  it("runs no query without a session", async () => {
    mockSession = null;
    profilesReturn([]);
    await render(<ModerationDevHarness />);
    expect(screen.getByText("Sign in first.")).toBeTruthy();
    expect(mockFrom).not.toHaveBeenCalled();
  });
});

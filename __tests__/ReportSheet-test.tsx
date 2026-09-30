import { act, fireEvent, render, screen } from "@testing-library/react-native";

// No <SafeAreaProvider> in the test tree — fixed insets stand in for it.
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

let mockSession: { user: { id: string } } | null = { user: { id: "me" } };
jest.mock("@/modules/auth", () => ({ useAuthSession: () => ({ session: mockSession }) }));

const mockReport = jest.fn();
jest.mock("@/modules/moderation/api/reportContent", () => ({
  reportContent: (...args: unknown[]) => mockReport(...args),
}));

const mockCapture = jest.fn();
jest.mock("@/lib/sentry", () => ({ Sentry: { captureException: (...args: unknown[]) => mockCapture(...args) } }));

import { ReportSheet } from "@/modules/moderation/components/ReportSheet";
import { OBJECTIONABLE_CATEGORIES } from "@/modules/moderation/objectionableCategories";
import type { ReportTarget } from "@/modules/moderation/types";

const TARGET: ReportTarget = { type: "profile", id: "u2", ownerId: "u2" };
const REASON_LABELS = [
  "Spam or scam",
  "Harassment or bullying",
  "Hate speech",
  "Sexual content",
  "Violence or threats",
  "Pretending to be someone else",
  "Something else",
];

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

const radio = (name: string) => screen.getByRole("radio", { name });
const send = () => screen.getByRole("button", { name: /^(Send report|Try again)$/ });
const pick = (name: string) => act(async () => void fireEvent.press(radio(name)));

describe("ReportSheet", () => {
  const onClose = jest.fn();
  const onReported = jest.fn();
  const show = (target = TARGET) => render(<ReportSheet target={target} onClose={onClose} onReported={onReported} />);

  beforeEach(() => {
    onClose.mockReset();
    onReported.mockReset();
    mockReport.mockReset().mockResolvedValue(undefined);
    mockCapture.mockReset();
    mockSession = { user: { id: "me" } };
  });

  it("OBJECTIONABLE_CATEGORIES holds the seven reasons in order", () => {
    expect(OBJECTIONABLE_CATEGORIES.map((c) => c.label)).toEqual(REASON_LABELS);
    expect(OBJECTIONABLE_CATEGORIES.every((c) => c.description.length > 0)).toBe(true);
  });

  it.each([
    ["profile", "Report this profile"],
    ["comment", "Report this comment"],
    ["dm_message", "Report this message"],
    ["collection_item", "Report this caption"],
  ] as const)("titles a %s report %s", async (type, title) => {
    await show({ ...TARGET, type });
    expect(screen.getByText(title)).toBeTruthy();
  });

  it("shows the verbatim copy, seven unselected radios in a radiogroup and a disabled Send", async () => {
    await show();
    expect(screen.getByText("Pick the closest reason. Reports are private.")).toBeTruthy();
    expect(screen.getAllByRole("radio").map((r) => r.props.accessibilityLabel)).toEqual(REASON_LABELS);
    expect(screen.queryAllByRole("radio", { selected: true })).toHaveLength(0);
    expect(JSON.stringify(screen.toJSON())).toContain(`"accessibilityRole":"radiogroup"`);
    expect(screen.getByRole("button", { name: "Cancel" })).toBeEnabled();
    expect(send()).toBeDisabled();
    expect(screen.queryByLabelText("Tell us more")).toBeNull();
  });

  it("selects one reason at a time, keeps a tapped selection, and enables Send", async () => {
    await show();
    await pick("Hate speech");
    expect(radio("Hate speech")).toBeSelected();
    await pick("Hate speech");
    expect(radio("Hate speech")).toBeSelected();
    await pick("Spam or scam");
    expect(radio("Spam or scam")).toBeSelected();
    expect(radio("Hate speech")).not.toBeSelected();
    expect(send()).toBeEnabled();
    expect(screen.queryByLabelText("Tell us more")).toBeNull();
  });

  it("Something else reveals a labelled details box; Send needs non-blank text, capped at 500 with a counter", async () => {
    await show();
    await pick("Something else");
    const input = screen.getByLabelText("Tell us more");
    expect(input.props.accessibilityHint).toBe("Required");
    expect(input.props.maxLength).toBe(500);
    expect(input.props.placeholder).toBe("What's the problem?");
    expect(screen.getByText("Tell us more (required)")).toBeTruthy();
    expect(screen.getByText("0/500")).toBeTruthy();
    expect(send()).toBeDisabled();

    await act(async () => void fireEvent.changeText(input, "   \n  "));
    expect(send()).toBeDisabled();

    await act(async () => void fireEvent.changeText(input, "they keep messaging me"));
    expect(screen.getByText("22/500")).toBeTruthy();
    expect(send()).toBeEnabled();
  });

  it("sends a non-other reason with no details, even if details were typed before switching", async () => {
    await show();
    await pick("Something else");
    await act(async () => void fireEvent.changeText(screen.getByLabelText("Tell us more"), "typed"));
    await pick("Hate speech");
    await act(async () => void fireEvent.press(send()));
    expect(mockReport).toHaveBeenCalledTimes(1);
    expect(mockReport).toHaveBeenCalledWith(TARGET, "hate", null);
  });

  it("sends 'other' with the trimmed details", async () => {
    await show();
    await pick("Something else");
    await act(async () => void fireEvent.changeText(screen.getByLabelText("Tell us more"), "  fake account  "));
    await act(async () => void fireEvent.press(send()));
    expect(mockReport).toHaveBeenCalledWith(TARGET, "other", "fake account");
  });

  it("success shows the sent state, fires onReported once, and closes only on Done", async () => {
    await show();
    await pick("Spam or scam");
    await act(async () => void fireEvent.press(send()));

    expect(screen.getByText("Report sent")).toBeTruthy();
    expect(
      screen.getByText(
        "Thanks — we'll take a look. Your report is private: the person you reported won't be told it came from you.",
      ),
    ).toBeTruthy();
    expect(onReported).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.queryByRole("radio")).toBeNull();

    await act(async () => void fireEvent.press(screen.getByRole("button", { name: "Done" })));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("an already-reported target (23505) lands on the identical sent state and is not sent to Sentry", async () => {
    mockReport.mockRejectedValue({ code: "23505", message: "duplicate key" });
    await show();
    await pick("Spam or scam");
    await act(async () => void fireEvent.press(send()));
    expect(screen.getByText("Report sent")).toBeTruthy();
    expect(onReported).toHaveBeenCalledTimes(1);
    expect(mockCapture).not.toHaveBeenCalled();
  });

  it("submitting dims and disables the list, shows Sending…, and a second tap sends one request", async () => {
    const pending = deferred();
    mockReport.mockReturnValue(pending.promise);
    await show();
    await pick("Spam or scam");
    await act(async () => void fireEvent.press(send()));

    expect(screen.getByText("Sending…")).toBeTruthy();
    expect(radio("Hate speech")).toBeDisabled();
    await act(async () => void fireEvent.press(radio("Hate speech")));
    expect(radio("Spam or scam")).toBeSelected();
    await act(async () => void fireEvent.press(screen.getByText("Sending…")));
    expect(mockReport).toHaveBeenCalledTimes(1);

    await act(async () => void pending.resolve());
    expect(screen.getByText("Report sent")).toBeTruthy();
  });

  it("Cancel mid-submit closes the sheet and the late result is ignored", async () => {
    const pending = deferred();
    mockReport.mockReturnValue(pending.promise);
    await show();
    await pick("Spam or scam");
    await act(async () => void fireEvent.press(send()));

    await act(async () => void fireEvent.press(screen.getByRole("button", { name: "Cancel" })));
    expect(onClose).toHaveBeenCalledTimes(1);

    await act(async () => void pending.resolve());
    expect(onReported).not.toHaveBeenCalled();
    expect(screen.queryByText("Report sent")).toBeNull();
  });

  it("unmounting mid-submit applies nothing and never calls onReported", async () => {
    const pending = deferred();
    mockReport.mockReturnValue(pending.promise);
    const view = await show();
    await pick("Spam or scam");
    await act(async () => void fireEvent.press(send()));
    await view.unmount();
    await act(async () => void pending.resolve());
    expect(onReported).not.toHaveBeenCalled();
  });

  it("a failed send shows the error card and Try again, keeps the reason and details, and retry resubmits", async () => {
    mockReport.mockRejectedValueOnce({ code: "42501", message: "row secret: fake account" });
    await show();
    await pick("Something else");
    await act(async () => void fireEvent.changeText(screen.getByLabelText("Tell us more"), "fake account"));
    await act(async () => void fireEvent.press(send()));

    expect(screen.getByRole("alert")).toBeTruthy();
    expect(screen.getByText("⚠ Couldn't send your report. Check your connection and try again.")).toBeTruthy();
    expect(radio("Something else")).toBeSelected();
    expect(screen.getByLabelText("Tell us more").props.value).toBe("fake account");
    expect(screen.getByRole("button", { name: "Cancel" })).toBeEnabled();

    await act(async () => void fireEvent.press(send()));
    expect(mockReport).toHaveBeenCalledTimes(2);
    expect(screen.getByText("Report sent")).toBeTruthy();
  });

  it.each(["23503", "42501"])("SQLSTATE %s goes to Sentry as a fresh error that does not echo the message", async (code) => {
    mockReport.mockRejectedValue({ code, message: "Failing row contains (fake account details)" });
    await show();
    await pick("Something else");
    await act(async () => void fireEvent.changeText(screen.getByLabelText("Tell us more"), "fake account details"));
    await act(async () => void fireEvent.press(send()));

    expect(mockCapture).toHaveBeenCalledTimes(1);
    const [error, hint] = mockCapture.mock.calls[0];
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe(`reportContent failed: ${code}`);
    expect(JSON.stringify([error.message, hint])).not.toContain("fake account");
    expect(screen.getByRole("alert")).toBeTruthy();
  });

  it("an offline failure (no SQLSTATE) shows the error card without a Sentry event", async () => {
    mockReport.mockRejectedValue(new TypeError("Network request failed"));
    await show();
    await pick("Spam or scam");
    await act(async () => void fireEvent.press(send()));
    expect(screen.getByRole("alert")).toBeTruthy();
    expect(mockCapture).not.toHaveBeenCalled();
  });

  it("scrim and Android back close the sheet when idle", async () => {
    await show();
    await act(async () => void fireEvent.press(screen.getByLabelText("Close", { includeHiddenElements: true })));
    await act(async () => void screen.getByTestId("report-sheet").props.onRequestClose());
    expect(onClose).toHaveBeenCalledTimes(2);
    expect(mockReport).not.toHaveBeenCalled();
  });

  it("refuses to open on the signed-in user's own content: renders nothing, closes, sends nothing", async () => {
    await show({ type: "comment", id: "c1", ownerId: "me" });
    expect(screen.queryByTestId("report-sheet")).toBeNull();
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(mockReport).not.toHaveBeenCalled();
  });

  it("with no session nothing is sent and the error card shows", async () => {
    mockSession = null;
    await show();
    await pick("Spam or scam");
    await act(async () => void fireEvent.press(send()));
    expect(mockReport).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toBeTruthy();
    expect(mockCapture).not.toHaveBeenCalled();
  });
});

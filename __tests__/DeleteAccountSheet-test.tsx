import { act, fireEvent, render, screen } from "@testing-library/react-native";

// No <SafeAreaProvider> in the test tree — fixed insets stand in for it.
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

const mockDeleteAccount = jest.fn();
let mockState = { isDeleting: false, failed: false };
let mockInFlight = false;
jest.mock("@/modules/auth/hooks/useDeleteAccount", () => ({
  useDeleteAccount: () => ({
    deleteAccount: mockDeleteAccount,
    isInFlight: () => mockInFlight,
    ...mockState,
  }),
}));

import { DeleteAccountSheet } from "@/modules/auth/components/DeleteAccountSheet";

const input = () => screen.getByLabelText("Type DELETE to confirm:");
const confirm = () => screen.getByRole("button", { name: "Delete my account" });

describe("DeleteAccountSheet", () => {
  const onClose = jest.fn();

  beforeEach(() => {
    onClose.mockReset();
    mockDeleteAccount.mockReset();
    mockState = { isDeleting: false, failed: false };
    mockInFlight = false;
  });

  it("shows the verbatim copy, the deletion list and a disabled confirm button", async () => {
    await render(<DeleteAccountSheet onClose={onClose} />);

    expect(screen.getByText("Delete your account?")).toBeTruthy();
    expect(screen.getByText("This permanently deletes:")).toBeTruthy();
    expect(screen.getByText("• Your profile, photo and usertag")).toBeTruthy();
    expect(screen.getByText("• Your watched collection and captions")).toBeTruthy();
    expect(screen.getByText("• Your comments, DMs and follow graph")).toBeTruthy();
    expect(screen.getByText("• Your Google sign-in link to Perchable")).toBeTruthy();
    expect(
      screen.getByText("This can't be undone. You'd need a fresh Google sign-up to use Perchable again."),
    ).toBeTruthy();
    expect(screen.getByText("Type DELETE to confirm:")).toBeTruthy();
    expect(confirm()).toBeDisabled();
  });

  it.each(["delete", " DELETE", "DELETE ", "DELET", "Delete", ""])(
    "keeps confirm disabled for %j",
    async (text) => {
      await render(<DeleteAccountSheet onClose={onClose} />);
      await act(async () => fireEvent.changeText(input(), text));
      expect(confirm()).toBeDisabled();
    },
  );

  it("enables confirm for exactly DELETE and runs the delete on tap", async () => {
    await render(<DeleteAccountSheet onClose={onClose} />);
    await act(async () => fireEvent.changeText(input(), "DELETE"));
    expect(confirm()).toBeEnabled();

    await act(async () => fireEvent.press(confirm()));
    expect(mockDeleteAccount).toHaveBeenCalledTimes(1);
  });

  it("does not delete when a disabled confirm is tapped", async () => {
    await render(<DeleteAccountSheet onClose={onClose} />);
    await act(async () => fireEvent.press(confirm()));
    expect(mockDeleteAccount).not.toHaveBeenCalled();
  });

  it("Cancel, the backdrop and Android back all close the sheet without deleting", async () => {
    await render(<DeleteAccountSheet onClose={onClose} />);

    await act(async () => fireEvent.press(screen.getByText("Cancel")));
    await act(async () => fireEvent.press(screen.getByLabelText("Close")));
    await act(async () => screen.getByTestId("delete-account-sheet").props.onRequestClose());

    expect(onClose).toHaveBeenCalledTimes(3);
    expect(mockDeleteAccount).not.toHaveBeenCalled();
  });

  it("while deleting shows the status line and Deleting…, disables Cancel and can't be dismissed", async () => {
    mockState = { isDeleting: true, failed: false };
    await render(<DeleteAccountSheet onClose={onClose} />);

    expect(screen.getByText("Deleting your data — this may take a moment.")).toBeTruthy();
    expect(screen.getByText("Deleting…")).toBeTruthy();
    expect(screen.queryByText("This permanently deletes:")).toBeNull();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();

    await act(async () => fireEvent.press(screen.getByLabelText("Close")));
    await act(async () => screen.getByTestId("delete-account-sheet").props.onRequestClose());
    expect(onClose).not.toHaveBeenCalled();
  });

  it("cannot be dismissed in the frame between the Delete tap and the re-render", async () => {
    mockInFlight = true;
    await render(<DeleteAccountSheet onClose={onClose} />);

    await act(async () => fireEvent.press(screen.getByText("Cancel")));
    await act(async () => fireEvent.press(screen.getByLabelText("Close")));
    await act(async () => screen.getByTestId("delete-account-sheet").props.onRequestClose());
    expect(onClose).not.toHaveBeenCalled();
  });

  it("shows the failure card in the confirm state and lets the user retry", async () => {
    mockState = { isDeleting: false, failed: true };
    await render(<DeleteAccountSheet onClose={onClose} />);

    expect(screen.getByText("⚠ Couldn't delete your account. Check your connection and try again.")).toBeTruthy();
    await act(async () => fireEvent.changeText(input(), "DELETE"));
    await act(async () => fireEvent.press(confirm()));
    expect(mockDeleteAccount).toHaveBeenCalledTimes(1);
  });
});

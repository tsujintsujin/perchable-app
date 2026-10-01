import { act, renderHook } from "@testing-library/react-native";

let mockSession: { user: { id: string } } | null = { user: { id: "me" } };
jest.mock("@/modules/auth", () => ({ useAuthSession: () => ({ session: mockSession }) }));

const mockReport = jest.fn();
jest.mock("@/modules/moderation/api/reportContent", () => ({
  reportContent: (...args: unknown[]) => mockReport(...args),
}));
const mockBlock = jest.fn();
jest.mock("@/modules/moderation/api/blockUser", () => ({
  blockUser: (...args: unknown[]) => mockBlock(...args),
}));
const mockCapture = jest.fn();
jest.mock("@/lib/sentry", () => ({ Sentry: { captureException: (...args: unknown[]) => mockCapture(...args) } }));

import { useBlockUser } from "@/modules/moderation/hooks/useBlockUser";
import { useReportContent } from "@/modules/moderation/hooks/useReportContent";

describe("moderation hook self-guards", () => {
  beforeEach(() => {
    mockSession = { user: { id: "me" } };
    mockReport.mockReset();
    mockBlock.mockReset();
    mockCapture.mockReset();
  });

  it("useReportContent refuses to report your own content: error state, no request, no Sentry", async () => {
    const onReported = jest.fn();
    const { result } = await renderHook(() =>
      useReportContent({ type: "comment", id: "c1", ownerId: "me" }, onReported),
    );
    await act(async () => void result.current.submit("spam", ""));
    expect(result.current.status).toBe("error");
    expect(mockReport).not.toHaveBeenCalled();
    expect(mockCapture).not.toHaveBeenCalled();
    expect(onReported).not.toHaveBeenCalled();
  });

  it("useBlockUser refuses to block yourself: error state, no request, no Sentry", async () => {
    const onBlocked = jest.fn();
    const { result } = await renderHook(() => useBlockUser("me", onBlocked));
    await act(async () => void result.current.block());
    expect(result.current.status).toBe("error");
    expect(mockBlock).not.toHaveBeenCalled();
    expect(mockCapture).not.toHaveBeenCalled();
    expect(onBlocked).not.toHaveBeenCalled();
  });
});

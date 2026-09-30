const mockInvoke = jest.fn();
jest.mock("@/lib/supabase", () => ({
  supabase: { functions: { invoke: (...args: unknown[]) => mockInvoke(...args) } },
}));

import { FunctionsFetchError, FunctionsHttpError, FunctionsRelayError } from "@supabase/supabase-js";
import { deleteAccount, DeleteAccountOfflineError } from "@/modules/auth/api/deleteAccount";

describe("deleteAccount", () => {
  beforeEach(() => mockInvoke.mockReset());

  it("calls the delete-account function with no body and resolves on success", async () => {
    mockInvoke.mockResolvedValue({ data: { ok: true }, error: null });
    await expect(deleteAccount()).resolves.toBeUndefined();
    expect(mockInvoke).toHaveBeenCalledWith("delete-account");
  });

  it("rejects on a 401: an invalid token is not a finished deletion", async () => {
    const unauthorized = new FunctionsHttpError({ status: 401 });
    mockInvoke.mockResolvedValue({ data: null, error: unauthorized });
    await expect(deleteAccount()).rejects.toBe(unauthorized);
  });

  it("rejects with the original error on a 500", async () => {
    const serverError = new FunctionsHttpError({ status: 500 });
    mockInvoke.mockResolvedValue({ data: null, error: serverError });
    await expect(deleteAccount()).rejects.toBe(serverError);
  });

  it("rejects with the original error when the relay fails", async () => {
    const relayError = new FunctionsRelayError({ status: 502 });
    mockInvoke.mockResolvedValue({ data: null, error: relayError });
    await expect(deleteAccount()).rejects.toBe(relayError);
  });

  it("rejects with DeleteAccountOfflineError when the request never reached the server", async () => {
    mockInvoke.mockResolvedValue({
      data: null,
      error: new FunctionsFetchError(new TypeError("Network request failed")),
    });
    await expect(deleteAccount()).rejects.toBeInstanceOf(DeleteAccountOfflineError);
  });
});

const mockAsync = new Map<string, string>();
const mockSecure = new Map<string, string>();
const mockSecureGet = jest.fn(async (k: string) => mockSecure.get(k) ?? null);
const mockCapture = jest.fn();
const mockAsyncGet = jest.fn(async (k: string) => mockAsync.get(k) ?? null);
const mockSecureDelete = jest.fn(async (k: string) => void mockSecure.delete(k));
const mockAsyncRemove = jest.fn(async (k: string) => void mockAsync.delete(k));
let mockStorage: {
  getItem: (k: string) => Promise<string | null>;
  setItem: (k: string, v: string) => Promise<void>;
  removeItem: (k: string) => Promise<void>;
};

jest.mock("react-native-url-polyfill/auto", () => ({}));
jest.mock("react-native-get-random-values", () => ({}));
jest.mock("@/lib/sentry", () => ({ Sentry: { captureException: (e: unknown) => mockCapture(e) } }));
jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: (k: string) => mockAsyncGet(k),
    setItem: async (k: string, v: string) => void mockAsync.set(k, v),
    removeItem: (k: string) => mockAsyncRemove(k),
  },
}));
jest.mock("expo-secure-store", () => ({
  getItemAsync: (k: string) => mockSecureGet(k),
  setItemAsync: async (k: string, v: string) => void mockSecure.set(k, v),
  deleteItemAsync: (k: string) => mockSecureDelete(k),
}));
jest.mock("@supabase/supabase-js", () => ({
  createClient: (_url: string, _key: string, options: { auth: { storage: typeof mockStorage } }) => {
    mockStorage = options.auth.storage;
    return { auth: { startAutoRefresh: jest.fn(), stopAutoRefresh: jest.fn() } };
  },
}));

let readStoredSession: () => Promise<unknown>;

beforeAll(() => {
  process.env.EXPO_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "anon";
  ({ readStoredSession } = require("@/lib/supabase"));
});

beforeEach(() => {
  mockAsync.clear();
  mockSecure.clear();
  mockCapture.mockReset();
  mockAsyncRemove.mockReset().mockImplementation(async (k: string) => void mockAsync.delete(k));
  mockAsyncGet.mockReset().mockImplementation(async (k: string) => mockAsync.get(k) ?? null);
  mockSecureDelete.mockReset().mockImplementation(async (k: string) => void mockSecure.delete(k));
  mockSecureGet.mockImplementation(async (k: string) => mockSecure.get(k) ?? null);
});

describe("LargeSecureStore", () => {
  it("removes a legacy plaintext session when SecureStore has no key", async () => {
    mockAsync.set("sess", '{"access_token":"x"}');

    expect(await mockStorage.getItem("sess")).toBeNull();
    expect(mockAsync.has("sess")).toBe(false);
  });

  it("round-trips an encrypted session", async () => {
    await mockStorage.setItem("sess", '{"access_token":"x"}');

    expect(mockAsync.get("sess")).not.toContain("access_token");
    expect(await mockStorage.getItem("sess")).toBe('{"access_token":"x"}');
  });

  it("returns null and removes nothing when storage is empty", async () => {
    expect(await mockStorage.getItem("sess")).toBeNull();
    expect(mockAsyncRemove).not.toHaveBeenCalled();
  });

  it("treats a corrupt (non-hex) value as signed out and removes it", async () => {
    await mockStorage.setItem("sess", "x");
    mockAsync.set("sess", "zz-not-hex");

    expect(await mockStorage.getItem("sess")).toBeNull();
    expect(mockAsync.has("sess")).toBe(false);
    expect(mockSecure.has("sess")).toBe(false);
  });

  it("reports to Sentry and returns null when SecureStore throws", async () => {
    await mockStorage.setItem("sess", "x");
    mockSecureGet.mockRejectedValue(new Error("keystore locked"));

    expect(await mockStorage.getItem("sess")).toBeNull();
    expect(mockCapture).toHaveBeenCalledTimes(1);
    expect(mockAsync.has("sess")).toBe(true);
  });

  it("purges a value whose key has the wrong length instead of failing every launch", async () => {
    await mockStorage.setItem("sess", "x");
    mockSecure.set("sess", "abcd");

    expect(await mockStorage.getItem("sess")).toBeNull();
    expect(mockAsync.has("sess")).toBe(false);
    expect(mockCapture).not.toHaveBeenCalled();
  });

  it("resolves null and reports to Sentry when AsyncStorage.getItem rejects", async () => {
    mockAsyncGet.mockRejectedValue(new Error("disk error"));

    expect(await mockStorage.getItem("sess")).toBeNull();
    expect(mockCapture).toHaveBeenCalledTimes(1);
  });

  it("resolves null and reports to Sentry when the purge itself fails", async () => {
    mockAsync.set("sess", "plaintext");
    mockSecureDelete.mockRejectedValue(new Error("delete failed"));

    expect(await mockStorage.getItem("sess")).toBeNull();
    expect(mockCapture).toHaveBeenCalledTimes(1);
  });

  it("removeItem still clears SecureStore when AsyncStorage.removeItem throws, then rethrows", async () => {
    await mockStorage.setItem("sess", "x");
    mockAsyncRemove.mockRejectedValue(new Error("async failed"));

    await expect(mockStorage.removeItem("sess")).rejects.toThrow("async failed");
    expect(mockSecure.has("sess")).toBe(false);
  });

  it("removeItem clears both stores", async () => {
    await mockStorage.setItem("sess", "x");
    await mockStorage.removeItem("sess");

    expect(mockAsync.has("sess")).toBe(false);
    expect(mockSecure.has("sess")).toBe(false);
  });
});

describe("readStoredSession", () => {
  it("returns the stored session", async () => {
    const session = { access_token: "a", refresh_token: "r", user: { id: "u" } };
    await mockStorage.setItem("sb-example-auth-token", JSON.stringify(session));

    expect(await readStoredSession()).toEqual(session);
  });

  it("returns null when nothing is stored, the JSON is bad, or required fields are missing", async () => {
    expect(await readStoredSession()).toBeNull();
    await mockStorage.setItem("sb-example-auth-token", "{not json");
    expect(await readStoredSession()).toBeNull();
    await mockStorage.setItem("sb-example-auth-token", '{"access_token":"a"}');
    expect(await readStoredSession()).toBeNull();
  });
});

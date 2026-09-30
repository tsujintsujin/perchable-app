const mockAsync = new Map<string, string>();
const mockSecure = new Map<string, string>();
const mockSecureGet = jest.fn(async (k: string) => mockSecure.get(k) ?? null);
const mockCapture = jest.fn();
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
    getItem: async (k: string) => mockAsync.get(k) ?? null,
    setItem: async (k: string, v: string) => void mockAsync.set(k, v),
    removeItem: (k: string) => mockAsyncRemove(k),
  },
}));
jest.mock("expo-secure-store", () => ({
  getItemAsync: (k: string) => mockSecureGet(k),
  setItemAsync: async (k: string, v: string) => void mockSecure.set(k, v),
  deleteItemAsync: async (k: string) => void mockSecure.delete(k),
}));
jest.mock("@supabase/supabase-js", () => ({
  createClient: (_url: string, _key: string, options: { auth: { storage: typeof mockStorage } }) => {
    mockStorage = options.auth.storage;
    return { auth: { startAutoRefresh: jest.fn(), stopAutoRefresh: jest.fn() } };
  },
}));

beforeAll(() => {
  process.env.EXPO_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "anon";
  require("@/lib/supabase");
});

beforeEach(() => {
  mockAsync.clear();
  mockSecure.clear();
  mockCapture.mockReset();
  mockAsyncRemove.mockClear();
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

  it("removeItem clears both stores", async () => {
    await mockStorage.setItem("sess", "x");
    await mockStorage.removeItem("sess");

    expect(mockAsync.has("sess")).toBe(false);
    expect(mockSecure.has("sess")).toBe(false);
  });
});

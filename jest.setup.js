// FlashList 2.0.2's own jestSetup replaces FlashList with an undefined export, so only
// its layout measuring is stubbed here (a fixed 400x900 screen) and the real list renders.
jest.mock("@shopify/flash-list/dist/recyclerview/utils/measureLayout", () => ({
  ...jest.requireActual("@shopify/flash-list/dist/recyclerview/utils/measureLayout"),
  measureParentSize: jest.fn(() => ({ x: 0, y: 0, width: 400, height: 900 })),
  measureFirstChildLayout: jest.fn(() => ({ x: 0, y: 0, width: 400, height: 900 })),
  measureItemLayout: jest.fn(() => ({ x: 0, y: 0, width: 100, height: 100 })),
}));

// AsyncStorage's native module does not exist under Jest: an in-memory stand-in built from plain functions
// (the package's own mock uses jest.fn, whose implementations a resetMocks/restoreMocks run would wipe).
jest.mock("@react-native-async-storage/async-storage", () => {
  const store = new Map();
  return {
    __esModule: true,
    default: {
      getItem: async (key) => (store.has(key) ? store.get(key) : null),
      setItem: async (key, value) => void store.set(key, String(value)),
      removeItem: async (key) => void store.delete(key),
      clear: async () => store.clear(),
    },
  };
});
// Gesture handler's own Jest stand-ins for its native module.
require("react-native-gesture-handler/jestSetup");

import {
  COMMIT_FRACTION,
  FLICK_MIN_DISTANCE,
  FLICK_VELOCITY,
  PAN_FAIL_Y,
  PAN_SLOP,
  decideSwipe,
} from "@/modules/quick-add/decideSwipe";
import { deckCardSize } from "@/modules/quick-add/deckLayout";
import { toastTitle } from "@/modules/quick-add/toastTitle";

const W = 400;
const COMMIT = COMMIT_FRACTION * W;

describe("decideSwipe constants", () => {
  it("are the PLAN M4 starting values", () => {
    expect([COMMIT_FRACTION, FLICK_VELOCITY, FLICK_MIN_DISTANCE, PAN_SLOP, PAN_FAIL_Y]).toEqual([0.35, 800, 40, 10, 20]);
  });
});

describe("decideSwipe", () => {
  it("does nothing below 35% of the width when slow", () => {
    expect(decideSwipe(COMMIT - 1, 0, W)).toBeNull();
    expect(decideSwipe(-(COMMIT - 1), 100, W)).toBeNull();
  });

  it("commits just above 35%, by the sign of the move", () => {
    expect(decideSwipe(COMMIT + 1, 0, W)).toBe("right");
    expect(decideSwipe(-(COMMIT + 1), 0, W)).toBe("left");
  });

  it("commits a short fast flick in the direction of the move", () => {
    expect(decideSwipe(FLICK_MIN_DISTANCE + 5, FLICK_VELOCITY + 100, W)).toBe("right");
    expect(decideSwipe(-(FLICK_MIN_DISTANCE + 5), -(FLICK_VELOCITY + 100), W)).toBe("left");
  });

  it("ignores a fast twitch under 40 dp", () => {
    expect(decideSwipe(FLICK_MIN_DISTANCE - 1, 5000, W)).toBeNull();
    expect(decideSwipe(-(FLICK_MIN_DISTANCE - 1), -5000, W)).toBeNull();
  });

  it("ignores a fast move whose velocity points the other way (a finger reversing)", () => {
    expect(decideSwipe(100, -2000, W)).toBeNull();
    expect(decideSwipe(-100, 2000, W)).toBeNull();
  });

  it("commits exactly on each boundary", () => {
    expect(decideSwipe(COMMIT, 0, W)).toBe("right");
    expect(decideSwipe(FLICK_MIN_DISTANCE, FLICK_VELOCITY, W)).toBe("right");
    expect(decideSwipe(FLICK_MIN_DISTANCE, FLICK_VELOCITY - 1, W)).toBeNull();
  });

  it("does not move without a translation", () => {
    expect(decideSwipe(0, 5000, W)).toBeNull();
  });

  it("does not divide by zero on a zero-width screen: only a flick can commit", () => {
    expect(decideSwipe(100, 0, 0)).toBeNull();
    expect(decideSwipe(100, FLICK_VELOCITY, 0)).toBe("right");
    expect(decideSwipe(100, 0, -5)).toBeNull();
  });
});

describe("deckCardSize", () => {
  it("is exactly 2:3 and gives the design numbers, 342 x 513 at 390 wide with a 566 high area", () => {
    expect(deckCardSize(390, 566)).toEqual({ width: 342, height: 513 });
  });

  it("with the Build 15 picker (area 508) is 324 x 486", () => {
    expect(deckCardSize(390, 508)).toEqual({ width: 324, height: 486 });
  });

  it("shrinks on a short area instead of scrolling, and never goes negative", () => {
    const small = deckCardSize(390, 300);
    expect(small.height / small.width).toBeCloseTo(1.5);
    expect(small.height).toBeLessThanOrEqual(300 - 20);
    expect(deckCardSize(390, 0)).toEqual({ width: 0, height: 0 });
  });

  it("keeps the 24 dp side margin on a narrow screen", () => {
    expect(deckCardSize(200, 900).width).toBeLessThanOrEqual(200 - 48);
  });
});

describe("toastTitle", () => {
  it("wraps a title in curly quotes", () => {
    expect(toastTitle("Dune: Part Two")).toBe("“Dune: Part Two”");
  });

  it("keeps a 28 character title whole", () => {
    const title = "a".repeat(28);
    expect(toastTitle(title)).toBe(`“${title}”`);
  });

  it("cuts a longer title to 27 characters plus an ellipsis inside the quotes", () => {
    expect(toastTitle("The Lord of the Rings: The Fellowship of the Ring")).toBe("“The Lord of the Rings: The…”");
  });

  it("counts an emoji as one character", () => {
    expect(toastTitle("🎬".repeat(30))).toBe(`“${"🎬".repeat(27)}…”`);
  });
});

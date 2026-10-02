/** The one file to tune the swipe feel: every gesture number the deck uses. */

/** The card commits once dragged this fraction of the screen width. */
export const COMMIT_FRACTION = 0.35;
/** A flick commits at this speed (dp/s) in the direction of the move... */
export const FLICK_VELOCITY = 800;
/** ...once the card has moved at least this far (dp). */
export const FLICK_MIN_DISTANCE = 40;
/** Horizontal movement (dp) before the pan takes over from a tap. */
export const PAN_SLOP = 10;
/** Vertical movement (dp) that makes the pan give up, so a scroll-like move never drags the card. */
export const PAN_FAIL_Y = 20;

export type SwipeDirection = "left" | "right";

/** Which way a released drag commits, or null when the card springs back. Distances in dp, velocity in dp/s. */
export function decideSwipe(translationX: number, velocityX: number, width: number): SwipeDirection | null {
  "worklet";
  if (translationX === 0) return null;
  const direction: SwipeDirection = translationX > 0 ? "right" : "left";
  const distance = Math.abs(translationX);
  // A zero-width screen has no meaningful distance rule; only a flick can commit.
  if (width > 0 && distance >= COMMIT_FRACTION * width) return direction;
  // Velocity must point the same way as the move: a finger reversing at the end is not a flick.
  const speed = direction === "right" ? velocityX : -velocityX;
  if (speed >= FLICK_VELOCITY && distance >= FLICK_MIN_DISTANCE) return direction;
  return null;
}

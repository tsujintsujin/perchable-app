import { size } from "@/ui/tokens";

/** The card size for a screen: exactly 2:3, as large as the width and the deck area allow, never scrolling. */
export function deckCardSize(screenWidth: number, areaHeight: number): { width: number; height: number } {
  const byWidth = Math.floor((screenWidth - 2 * size.deckSideMargin) / 2);
  const byHeight = Math.floor((areaHeight - size.deckStackReserve) / 3);
  const k = Math.max(0, Math.min(byWidth, byHeight));
  return { width: 2 * k, height: 3 * k };
}

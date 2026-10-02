/** Longest title a Toast shows, quotes excluded. */
const MAX_TOAST_TITLE = 28;

/** The title in curly quotes for a Toast; a long one is cut to 27 characters (no space left before the ellipsis) plus an ellipsis inside the quotes. */
export function toastTitle(title: string): string {
  const chars = Array.from(title.trim());
  const shown = chars.length > MAX_TOAST_TITLE ? `${chars.slice(0, MAX_TOAST_TITLE - 1).join("").trimEnd()}…` : chars.join("");
  return `“${shown}”`;
}

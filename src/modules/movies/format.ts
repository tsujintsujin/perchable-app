/** "45m", "2h" or "2h 28m"; null for a missing or non-positive runtime. */
export function formatRuntime(minutes: number | null | undefined): string | null {
  if (!minutes || minutes <= 0) return null;
  const total = Math.round(minutes);
  const hours = Math.floor(total / 60);
  const rest = total % 60;
  if (hours === 0) return `${rest}m`;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
}

/** The TMDB rating to one decimal, or null when nobody has voted (or the value is unusable). */
export function formatRating(average: number | null | undefined, votes: number | null | undefined): string | null {
  if (!votes || votes <= 0 || average === null || average === undefined || !Number.isFinite(average)) return null;
  return average.toFixed(1);
}

/** "{year} · {runtime}" with a missing part left out; null when both are missing. */
export function metaLine(year: number | null, runtime: string | null): string | null {
  const parts = [year === null ? null : String(year), runtime].filter((part): part is string => part !== null);
  return parts.length > 0 ? parts.join(" · ") : null;
}

/** The title to show: the movie's own, or "Untitled" when it is empty or blank. */
export function displayTitle(title: string): string {
  return title.trim() || "Untitled";
}

export const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/";

/** TMDB image widths used by the app: grid poster, details poster, details backdrop, cast photo. */
export const IMAGE_SIZE = { poster: "w342", detailsPoster: "w500", backdrop: "w780", cast: "w185" } as const;

export type ImageSize = (typeof IMAGE_SIZE)[keyof typeof IMAGE_SIZE];

/** Full image URL for a TMDB image path, or null when there is no path. */
export function tmdbImage(path: string | null | undefined, size: ImageSize): string | null {
  return path ? `${TMDB_IMAGE_BASE}${size}${path}` : null;
}

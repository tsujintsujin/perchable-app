/** The year of a TMDB `release_date`, or null when it is empty or malformed. */
export function releaseYear(releaseDate: string | null | undefined): number | null {
  const match = releaseDate?.match(/^\d{4}/);
  return match ? Number(match[0]) : null;
}

import { IMAGE_SIZE, tmdbImage } from "@/modules/movies/tmdbImage";
import { releaseYear } from "@/modules/movies/releaseYear";

describe("tmdbImage", () => {
  it("joins base, size and path", () => {
    expect(tmdbImage("/abc.jpg", IMAGE_SIZE.poster)).toBe("https://image.tmdb.org/t/p/w342/abc.jpg");
  });

  it("returns null for a null, undefined or empty path", () => {
    expect(tmdbImage(null, IMAGE_SIZE.poster)).toBeNull();
    expect(tmdbImage(undefined, IMAGE_SIZE.poster)).toBeNull();
    expect(tmdbImage("", IMAGE_SIZE.poster)).toBeNull();
  });

  it("uses the M6 sizes", () => {
    expect(IMAGE_SIZE).toEqual({ poster: "w342", detailsPoster: "w500", backdrop: "w780", deck: "w780", cast: "w185" });
  });
});

describe("releaseYear", () => {
  it("reads the first four digits", () => {
    expect(releaseYear("2024-05-01")).toBe(2024);
  });

  it.each([[""], [null], [undefined], ["abc"], ["24-05-01"], ["NaN"]])("omits %p", (value) => {
    expect(releaseYear(value)).toBeNull();
  });
});

// The Browse genre filters: 29 of them, each checked against the names AniList really has.
import { test } from "node:test";
import assert from "node:assert/strict";
import { GENRE_FILTERS, resolveGenreFilters, genreReport } from "../features/genres.js";

const genres = ["Action", "Adventure", "Comedy", "Drama", "Ecchi", "Fantasy", "Hentai", "Horror", "Mahou Shoujo", "Mecha", "Music", "Mystery",
  "Psychological", "Romance", "Sci-Fi", "Slice of Life", "Sports", "Supernatural", "Thriller"];
const tags = ["Isekai", "Harem", "Reverse Harem", "Cyberpunk", "Steampunk", "Iyashikei", "Military", "Space Opera", "Post-Apocalyptic",
  "Boys\u2019 Love", "Yuri", "Villainess"];

test("the list is exactly the 29 you asked for, in order, each with a meaning", () => {
  assert.equal(GENRE_FILTERS.length, 29);
  assert.deepEqual(GENRE_FILTERS.slice(0, 4).map((f) => f.label), ["Action", "Adventure", "Boys' Love", "Comedy"]);
  assert.equal(GENRE_FILTERS.at(-1).label, "Thriller");
  assert.equal(new Set(GENRE_FILTERS.map((f) => f.label)).size, 29);
  GENRE_FILTERS.forEach((f) => assert.ok(f.hint.length > 5, f.label));
});

test("genres go to AniList as genres and tags as tags, using AniList's own spelling", () => {
  const found = Object.fromEntries(resolveGenreFilters(genres, tags).map((f) => [f.label, f]));
  assert.deepEqual([found.Action.kind, found.Action.value], ["genre", "Action"]);
  assert.deepEqual([found.Isekai.kind, found.Isekai.value], ["tag", "Isekai"]);
  assert.deepEqual([found["Magical Girl"].kind, found["Magical Girl"].value], ["genre", "Mahou Shoujo"]); // AniList calls it Mahou Shoujo
  assert.deepEqual([found["Boys' Love"].kind, found["Boys' Love"].value], ["tag", "Boys\u2019 Love"]); // curly apostrophe: matched, and sent as AniList spells it
  assert.deepEqual([found["Girls' Love"].kind, found["Girls' Love"].value], ["tag", "Yuri"]); // falls back to the other name
  assert.equal(found["Music / Idol"].value, "Music");
});

test("a filter AniList has no name for is left out, and reported", () => {
  const r = genreReport(genres, tags);
  assert.ok(r.missing.includes("Suspense")); // not in this made-up AniList
  assert.ok(!r.found.some((f) => f.label === "Suspense"));
  assert.equal(r.found.length + r.missing.length, 29);
});

test("if AniList's lists can't be loaded, every filter is trusted as listed", () => {
  const all = resolveGenreFilters(null, null);
  assert.equal(all.length, 29);
  assert.deepEqual([all.find((f) => f.label === "Isekai").kind, all.find((f) => f.label === "Action").kind], ["tag", "genre"]);
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { memoryStorage, fakeAniList, media } from "./helpers.js";
import { GENRE_ROWS, genreQuery, genreFilter } from "../features/genreRows.js";

memoryStorage();
const a = await import("../api/anilist.js");

test("Isekai Heaven asks for Isekai or Reincarnation; Shonen Feast for shonen action", () => {
  assert.deepEqual(genreQuery("isekai"), { tags: ["Isekai", "Reincarnation"] });
  assert.deepEqual(genreQuery("shonen"), { genre: "Action", tag: "Shounen", genreNotIn: ["Romance", "Sports", "Ecchi"] });
  assert.deepEqual(genreQuery("talk"), {}); // other tiles have no genre filter
  assert.deepEqual(Object.keys(GENRE_ROWS), ["isekai", "shonen"]);
});

test("Shonen Feast leaves romance, sports and ecchi out; other tiles pass through untouched", () => {
  const shows = [
    { id: 1, genres: ["Action", "Adventure"] }, { id: 2, genres: ["Action", "Ecchi"] }, { id: 3 },
    { id: 4, genres: ["Action", "Romance"] }, { id: 5, genres: ["Action", "Sports"] },
  ];
  assert.deepEqual(genreFilter("shonen", shows).map((s) => s.id), [1, 3]);
  assert.equal(genreFilter("isekai", shows).length, 5); // reborn stories keep every genre
  assert.equal(genreFilter("talk", shows).length, 5);
});

test("the AniList query matches ANY of the tags, strongly (tag_in with a minimum rank)", async () => {
  const calls = fakeAniList(() => ({ Page: { pageInfo: { hasNextPage: false }, media: [media(1)] } }));
  await a.fetchAniList("anime", { sort: "popular", ...genreQuery("isekai") });
  assert.match(calls[0].query, /tag_in: \$tags/);
  assert.match(calls[0].query, /tagMinimumRank: 60/);
  assert.deepEqual(calls[0].variables.tags, ["Isekai", "Reincarnation"]);

  const shonen = fakeAniList(() => ({ Page: { pageInfo: { hasNextPage: false }, media: [media(2)] } }));
  await a.fetchAniList("anime", { sort: "popular", ...genreQuery("shonen") });
  assert.match(shonen[0].query, /genre: \$genre/);
  assert.match(shonen[0].query, /tag: \$tag\b/);
  assert.equal(shonen[0].variables.genre, "Action");
  assert.equal(shonen[0].variables.tag, "Shounen");
  assert.match(shonen[0].query, /genre_not_in: \$genreNotIn/); // romance and sports are cut by AniList, so pages stay full
  assert.deepEqual(shonen[0].variables.genreNotIn, ["Romance", "Sports", "Ecchi"]);
});

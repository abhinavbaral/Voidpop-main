import { test } from "node:test";
import assert from "node:assert/strict";
import { memoryStorage } from "./helpers.js";
import { GENRE_ROWS, genreQuery, genreFilter } from "../features/genreRows.js";

memoryStorage();

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

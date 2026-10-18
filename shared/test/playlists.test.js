// Your Library as playlists: every status is one, and so is each list you make.
import { test } from "node:test";
import assert from "node:assert/strict";
import { memoryStorage } from "./helpers.js";
import { buildPlaylists, playlistEntries, searchEntries, PLAYLIST_SORTS } from "../features/playlists.js";

memoryStorage();
const store = await import("../backend/store.js");

const entry = (id, status, updatedAt, cats = []) => ({ item: { id, segment: "anime", title: `Show ${id}`, image: `img${id}` }, status, updatedAt, cats });
const statuses = [{ key: "watching", label: "Watching" }, { key: "completed", label: "Completed" }, { key: "plan", label: "Plan to Watch" }];
const entries = [
  entry(1, "watching", "2026-10-01"), entry(2, "watching", "2026-10-05", ["c1"]), entry(3, "completed", "2026-09-01"),
  entry(4, "completed", "2026-09-02"), entry(5, "completed", "2026-09-03", ["c1"]), entry(6, "completed", "2026-09-04"), entry(7, "completed", "2026-09-05"),
];
const cats = [{ id: "c1", name: "Hidden gems" }, { id: "c2", name: "Rewatch" }];

test("every status and every playlist of your own is a playlist, empty ones included", () => {
  const p = buildPlaylists(entries, statuses, cats);
  assert.deepEqual(p.map((x) => x.name).sort(), ["Completed", "Hidden gems", "Plan to Watch", "Rewatch", "Watching"]);
  const by = Object.fromEntries(p.map((x) => [x.name, x]));
  assert.deepEqual([by.Watching.count, by.Completed.count, by["Plan to Watch"].count, by["Hidden gems"].count, by.Rewatch.count], [2, 5, 0, 2, 0]);
  assert.deepEqual([by.Watching.owner, by["Hidden gems"].owner, by.Watching.type, by["Hidden gems"].type], ["VoidPop", "You", "status", "custom"]);
});

test("a playlist's cover is its 4 most recent titles", () => {
  const by = Object.fromEntries(buildPlaylists(entries, statuses, cats).map((x) => [x.name, x]));
  assert.deepEqual(by.Completed.covers, ["img7", "img6", "img5", "img4"]);
  assert.deepEqual(by.Watching.covers, ["img2", "img1"]);
  assert.deepEqual(by["Plan to Watch"].covers, []);
});

test("sorting: recents (empty ones last), A–Z, most titles", () => {
  assert.deepEqual(PLAYLIST_SORTS.map((s) => s.key), ["recents", "alpha", "size"]);
  assert.deepEqual(buildPlaylists(entries, statuses, cats, "recents").map((x) => x.name), ["Watching", "Hidden gems", "Completed", "Plan to Watch", "Rewatch"]);
  assert.deepEqual(buildPlaylists(entries, statuses, cats, "alpha").map((x) => x.name), ["Completed", "Hidden gems", "Plan to Watch", "Rewatch", "Watching"]);
  assert.equal(buildPlaylists(entries, statuses, cats, "size")[0].name, "Completed");
});

test("opening a playlist and searching", () => {
  assert.deepEqual(playlistEntries(entries, "status", "watching").map((e) => e.item.id), [1, 2]);
  assert.deepEqual(playlistEntries(entries, "custom", "c1").map((e) => e.item.id), [2, 5]);
  assert.deepEqual(searchEntries(entries, " show 3 ").map((e) => e.item.id), [3]);
  assert.deepEqual(searchEntries(entries, "   "), []);
});

test("anyone can make a playlist; the Explore rows stay a reward for 500 completed anime", async () => {
  assert.equal(await store.categoriesUnlocked(), true);
  assert.ok(await store.addCategory("Hidden gems"));
  assert.equal(await store.addCategory("hidden GEMS"), null); // same name twice
  assert.equal((await store.getCategoryAccess()).unlocked, false); // the spotlight rows still need 500
  assert.deepEqual(await store.loadCategoryRows(new Date("2026-10-16")), []);
});

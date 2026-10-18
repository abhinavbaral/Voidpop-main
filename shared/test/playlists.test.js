// Your Library as playlists: every status that has titles in it is one.
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildPlaylists, playlistEntries, searchEntries, PLAYLIST_SORTS } from "../features/playlists.js";

const entry = (id, status, updatedAt) => ({ item: { id, segment: "anime", title: `Show ${id}`, image: `img${id}` }, status, updatedAt });
const statuses = [{ key: "watching", label: "Watching" }, { key: "completed", label: "Completed" }, { key: "plan", label: "Plan to Watch" }];
const entries = [
  entry(1, "watching", "2026-10-01"), entry(2, "watching", "2026-10-05"), entry(3, "completed", "2026-09-01"),
  entry(4, "completed", "2026-09-02"), entry(5, "completed", "2026-09-03"), entry(6, "completed", "2026-09-04"), entry(7, "completed", "2026-09-05"),
];

test("a status with no titles is not shown", () => {
  const p = buildPlaylists(entries, statuses);
  assert.deepEqual(p.map((x) => x.name).sort(), ["Completed", "Watching"]); // Plan to Watch has none
  const by = Object.fromEntries(p.map((x) => [x.name, x]));
  assert.deepEqual([by.Watching.count, by.Completed.count], [2, 5]);
  assert.equal(by.Watching.owner, "VoidPop");
  assert.deepEqual(buildPlaylists([], statuses), []); // an empty library has no playlists at all
});

test("a playlist's cover is one show: its most recently changed title", () => {
  const by = Object.fromEntries(buildPlaylists(entries, statuses).map((x) => [x.name, x]));
  assert.equal(by.Completed.cover, "img7");
  assert.equal(by.Watching.cover, "img2");
  assert.equal(by.Completed.covers, undefined); // no collage of several
  // a title without a picture is skipped for the cover
  const noPic = [{ ...entry(8, "plan", "2026-10-09"), item: { id: 8, segment: "anime", title: "No pic" } }, entry(9, "plan", "2026-10-02")];
  assert.equal(buildPlaylists(noPic, statuses)[0].cover, "img9");
});

test("sorting: recents, A–Z, most titles", () => {
  assert.deepEqual(PLAYLIST_SORTS.map((s) => s.key), ["recents", "alpha", "size"]);
  assert.deepEqual(buildPlaylists(entries, statuses, "recents").map((x) => x.name), ["Watching", "Completed"]);
  assert.deepEqual(buildPlaylists(entries, statuses, "alpha").map((x) => x.name), ["Completed", "Watching"]);
  assert.equal(buildPlaylists(entries, statuses, "size")[0].name, "Completed");
});

test("opening a playlist and searching", () => {
  assert.deepEqual(playlistEntries(entries, "watching").map((e) => e.item.id), [1, 2]);
  assert.deepEqual(searchEntries(entries, " show 3 ").map((e) => e.item.id), [3]);
  assert.deepEqual(searchEntries(entries, "   "), []);
});

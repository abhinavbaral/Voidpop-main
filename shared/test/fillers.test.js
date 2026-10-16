// The filler guide, skipped episodes, and the Considering status.
import { test } from "node:test";
import assert from "node:assert/strict";
import { memoryStorage } from "./helpers.js";

memoryStorage();
const store = await import("../backend/store.js");
const F = await import("../features/fillers.js");
const { computeAchievements } = await import("../features/achievements.js");

// a made-up show: 20 episodes, 5-8 filler, 12-13 anime canon, 15 mixed
F.setFillerDb({ 7001: { name: "Test Show", afl: "test-show", filler: "5-8", animeCanon: "12-13", mixed: "15" } });
const show = { id: 7001, segment: "anime", title: "Test Show", episodes: 20, finished: true, duration: 30 };

test("ranges: parse, merge, count, add, remove", () => {
  assert.deepEqual(F.parseRanges("54-61, 98, 131-133, x, 60-62"), [[54, 62], [98, 98], [131, 133]]);
  assert.equal(F.rangesToString(F.parseRanges("1-3,4,9")), "1-4,9");
  assert.equal(F.countIn([[54, 61]], 50, 56), 3);
  assert.deepEqual(F.removeRange([[5, 10]], 7, 8), [[5, 6], [9, 10]]);
  assert.deepEqual(F.addRange([[5, 6]], 7), [[5, 7]]);
});

test("the guide: types, summary, next block", () => {
  const info = F.fillerFor(show);
  assert.equal(F.typeOf(info, 6), "filler");
  assert.equal(F.typeOf(info, 12), "animeCanon");
  assert.equal(F.typeOf(info, 15), "mixed");
  assert.equal(F.typeOf(info, 1), "canon");
  assert.equal(F.canSkip(info, 15), false); // mixed is not skippable
  const sum = F.fillerSummary(info, show);
  assert.deepEqual([sum.filler, sum.animeCanon, sum.mixed, sum.canon, sum.percent, sum.hours], [4, 2, 1, 13, 20, 3]);
  assert.deepEqual(F.nextBlock(info, 2, 20), { type: "filler", from: 5, to: 8, away: 2 });
  assert.deepEqual(F.nextBlock(info, 6, 20), { type: "filler", from: 7, to: 8, away: 0 });
  assert.equal(F.nextBlock(info, 13, 20), null);
  assert.equal(F.fillerFor({ id: 1, segment: "manga" }), null);
  assert.equal(F.fillerFor({ id: 99999, segment: "anime" }), null);
});

test("a database with overlapping or unreadable ranges is reported", () => {
  assert.deepEqual(F.checkFillerDb({ 1: { filler: "1-5", mixed: "5-6" } }).length, 1);
  assert.equal(F.checkFillerDb({ 1: { filler: "abc" } }).length, 1);
  assert.deepEqual(F.checkFillerDb({ 1: { filler: "1-5", animeCanon: "7", mixed: "9" } }), []);
});

test("skip: only filler / anime canon you haven't reached; +1 jumps over them", async () => {
  await store.setStatus(null, "anime", show, "watching");
  await store.setProgress(null, show, 3, "typed");
  // 4 is canon, 15 is mixed, 2 is already behind you: only 5-8 and 12-13 can be skipped
  assert.deepEqual(await store.skipEpisodes(show, 1, 20), { skipped: 6 });
  let e = (await store.getLibrary())["anime:7001"];
  assert.deepEqual(e.skipped, [[5, 8], [12, 13]]);
  assert.equal(store.nextToWatch(e), 4);
  await store.setProgress(null, show, 4, "plus"); // watch 4
  const r = await store.setProgress(null, show, 5, "plus"); // +1: 5-8 are skipped → lands on 9
  assert.equal(r.progress, 9);
  e = (await store.getLibrary())["anime:7001"];
  assert.equal(store.watchedOf(e), 5); // 1-9 minus 5-8 skipped = 5 watched
  // the log counted only the episodes watched: 3 typed + 1 + 1
  const log = (await store.getLog()).filter(([, k, , src]) => k === "anime:7001" && src !== "complete" && !String(src).startsWith("status"));
  assert.deepEqual(log.map(([, , c]) => c), [3, 1, 1]);
});

test("behind / left counts, stats and achievements ignore skipped episodes", async () => {
  const e = (await store.getLibrary())["anime:7001"];
  // progress 9, finished with 20 out, skipped 5-8 (done) and 12-13: 11 left minus the 2 skipped ahead
  assert.equal(store.behindBy(e), 9);
  assert.equal(store.leftToWatch(e), 9);
  const stats = await store.getStats();
  assert.equal(stats.episodesWatched, 5);
  assert.equal(stats.minutesWatched, 5 * 30);
  const a = Object.fromEntries((await computeAchievements()).map((x) => [x.key, x]));
  assert.equal(a.otaku.have, 5); // the Otaku achievement counts watched episodes, not skipped ones
});

test("skipped episodes count toward finishing: the last +1 jumps to the end", async () => {
  await store.setProgress(null, show, 11, "typed"); // up to 11
  const r = await store.setProgress(null, show, 12, "plus"); // 12-13 skipped → 14
  assert.equal(r.progress, 14);
  const done = await store.setProgress(null, show, 20, "typed");
  assert.equal(done.reachedEnd, true);
});

test("unskip puts episodes back", async () => {
  assert.deepEqual(await store.unskipEpisodes(show, 12, 13), { unskipped: 2 });
  const e = (await store.getLibrary())["anime:7001"];
  assert.deepEqual(e.skipped, [[5, 8]]);
});

test("Considering: its own status, left out of counts, never sent to AniList", async () => {
  assert.ok(store.statusesFor("anime").some((x) => x.key === "considering"));
  const maybe = { id: 7002, segment: "anime", title: "Maybe", episodes: 12, nextEpisode: null, finished: true };
  await store.setStatus(null, "anime", maybe, "considering");
  const e = (await store.getLibrary())["anime:7002"];
  assert.equal(store.leftToWatch(e), null); // no "new episodes" badge
  assert.equal(store.yourShows(await store.getLibrary()).some((x) => x.item.id === 7002), false);
  const unreleased = { id: 7003, segment: "anime", title: "Soon", unreleased: true };
  assert.deepEqual(store.statusesAllowed(unreleased).map((x) => x.key), ["plan", "considering"]);
  await store.setProgress(null, maybe, 1, "plus"); // starting it makes it Watching
  assert.equal((await store.getLibrary())["anime:7002"].status, "watching");
});

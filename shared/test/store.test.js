import { test } from "node:test";
import assert from "node:assert/strict";
import { memoryStorage, daysAgo } from "./helpers.js";

memoryStorage();
const s = await import("../backend/store.js");

const anime = (id, extra = {}) => ({ id, segment: "anime", title: `A${id}`, episodes: 12, finished: true, ...extra });
const lib = async () => s.getLibrary();

test("Completed fills progress; statuses include Rewatching / Rereading", async () => {
  await s.setStatus(null, "anime", anime(1), "completed");
  assert.equal((await lib())["anime:1"].progress, 12);
  assert.deepEqual(s.statusesFor("manga").map((x) => x.label), ["Reading", "Finished", "Rereading", "Plan to Read", "Considering", "On Hold", "Dropped"]);
});

test("progress is capped at what has aired and starts a planned title", async () => {
  const airing = anime(2, { finished: false, episodes: 24, nextEpisode: { episode: 8, airingAt: Math.floor(Date.now() / 1000) + 3600 } });
  await s.setStatus(null, "anime", airing, "plan");
  const r = await s.setProgress(null, airing, 50);
  assert.equal(r.progress, 7); // episodes 1–7 are out
  assert.equal(r.status, "watching");
  assert.match(s.checkProgress(airing, "9"), /Only 7 episodes are out/);
  assert.equal(s.checkProgress(airing, "7"), null);
  assert.equal(s.leftToWatch({ ...(await lib())["anime:2"] }), 0);
});

test("rewatch: resets progress, still counts as finished, finishing counts the rewatch", async () => {
  const before = (await s.getStats()).totalCompleted;
  await s.setStatus(null, "anime", anime(1), "rewatching");
  assert.equal((await lib())["anime:1"].progress, 0);
  assert.equal((await s.getStats()).totalCompleted, before);
  const mid = await s.setProgress(null, anime(1), 5);
  assert.equal(mid.status, "rewatching");
  const end = await s.setProgress(null, anime(1), 12);
  assert.equal(end.status, "completed");
  assert.equal(end.rewatchDone, true);
  assert.equal(end.reachedEnd, false); // no second verdict prompt
  assert.equal((await lib())["anime:1"].rewatches, 1);
});

test("reviews keep verdict, vibes, moods and comment", async () => {
  await s.addReview(null, "anime", 1, { verdict: "peak", vibes: ["Action"], moods: ["Made me cry"], comment: "great" });
  const r = await s.getMyReview(null, "anime", 1);
  assert.deepEqual([r.verdict, r.vibes, r.moods, r.comment], ["peak", ["Action"], ["Made me cry"], "great"]);
});

test("notes: trimmed, cleared by empty text", async () => {
  assert.equal(await s.setNote("anime", 1, "  stopped at ep 5  "), "stopped at ep 5");
  assert.equal(await s.getNote("anime", 1), "stopped at ep 5");
  await s.setNote("anime", 1, "   ");
  assert.equal(await s.getNote("anime", 1), "");
});

test("Excited titles move to Watching once out; Plan moves too; other statuses stay", async () => {
  const up = (id) => anime(id, { unreleased: true, finished: false });
  for (const id of [10, 11, 12, 13]) await s.toggleExcited(null, up(id));
  await s.setStatus(null, "anime", up(12), "plan");
  await s.setStatus(null, "anime", anime(13), "dropped");
  const fresh = { 10: anime(10, { finished: false }), 11: up(11), 12: anime(12), 13: anime(13) };
  const moved = await s.promoteExcited(async () => fresh);
  assert.deepEqual(moved.map((x) => x.id).sort(), [10, 12]);
  const l = await lib();
  assert.equal(l["anime:10"].status, "watching");
  assert.equal(l["anime:11"], undefined); // still not out
  assert.equal(l["anime:13"].status, "dropped");
  assert.equal((await s.promoteExcited(async () => fresh)).length, 0); // only once
});

test("MAL import adds new titles and never overwrites yours", async () => {
  const r = await s.importMalEntries([
    { item: anime(20), status: "completed", progress: 3, times: 2 },
    { item: anime(1), status: "dropped", progress: 1, times: 0 },
  ]);
  assert.deepEqual(r, { added: 1, kept: 1 });
  const l = await lib();
  assert.equal(l["anime:20"].progress, 12);
  assert.equal(l["anime:20"].rewatches, 2);
  assert.equal(l["anime:1"].status, "completed");
});

test("categories unlock at 500 completed anime", async () => {
  const a = await s.getCategoryAccess();
  assert.equal(a.unlocked, false);
  assert.equal(a.needed, s.CATEGORY_MIN - a.animeCompleted);
});

test("CSV export quotes fields and has a header", async () => {
  await s.setStatus(null, "anime", anime(30, { title: 'Say "Hi", World' }), "plan");
  const csv = await s.exportLibraryCsv();
  assert.match(csv.split("\n")[0], /^Type,Title,Status,Progress/);
  assert.ok(csv.includes('"Say ""Hi"", World"'));
});

test("updatedAt helper sanity", () => {
  assert.ok(daysAgo(1) < new Date().toISOString());
});

test("welcome screens: shown until marked done", async () => {
  assert.equal(await s.isOnboarded(), false);
  await s.setOnboarded(true);
  assert.equal(await s.isOnboarded(), true);
  await s.setOnboarded(false);
  assert.equal(await s.isOnboarded(), false);
});

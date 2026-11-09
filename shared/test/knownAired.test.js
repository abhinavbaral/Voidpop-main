// "AniList's schedule is wrong": you say how many episodes are out, and pending / +1 / Schedule follow that number.
import test from "node:test";
import assert from "node:assert/strict";
import { memoryStorage } from "./helpers.js";

memoryStorage();
const s = await import("../backend/store.js");

const NOW = Date.parse("2026-11-11T12:00:00Z");
const hrs = (h) => Math.floor(NOW / 1000) + h * 3600;
const anime = (id, extra = {}) => ({ id, segment: "anime", title: `A${id}`, ...extra });
const entry = (item, status, progress = 0) => ({ item, status, progress });

test("AniList says finished with 12, you say 16 are out: 4 pending, and the total is no longer trusted", () => {
  const item = anime(1, { finished: true, episodes: 12, endDate: "2026-11-05", knownAired: 16 });
  assert.equal(s.airedFor(item, NOW), 16);
  assert.equal(s.totalFor(item), null);
  assert.equal(s.behindBy(entry(item, "watching", 12), NOW), 4);
  // without the override the same show is "all caught up" at 12
  assert.equal(s.behindBy(entry({ ...item, knownAired: undefined }, "watching", 12), NOW), 0);
});

test("an override never lowers what AniList counts", () => {
  const item = anime(2, { finished: false, episodes: 24, nextEpisode: { episode: 9, airingAt: hrs(24) }, knownAired: 5 });
  assert.equal(s.airedFor(item, NOW), 8);
});

test("a show with no schedule at all (AniList lists nothing) gets pending from the number you set", () => {
  const item = anime(3, { finished: false, episodes: null, nextEpisode: null, knownAired: 7 });
  const lib = { "anime:3": entry(item, "watching", 5) };
  const [row] = s.yourShows(lib, {}, NOW);
  assert.equal(row.pending, 2);
});

test("pending shows are told apart from caught-up ones (Pending tab vs Anime this week)", () => {
  const behind = anime(4, { finished: false, nextEpisode: { episode: 6, airingAt: hrs(48) } }); // 5 out
  const upToDate = anime(5, { finished: false, nextEpisode: { episode: 6, airingAt: hrs(48) } });
  const lib = { "anime:4": entry(behind, "watching", 2), "anime:5": entry(upToDate, "watching", 5) };
  const rows = s.yourShows(lib, {}, NOW);
  assert.deepEqual(rows.filter((r) => r.pending > 0).map((r) => r.item.id), [4]);
  assert.deepEqual(rows.filter((r) => !(r.pending > 0)).map((r) => r.item.id), [5]);
});

test("setKnownAired saves it, setProgress can pass AniList's number, and a fresh item doesn't lose it", async () => {
  const stale = anime(6, { finished: true, episodes: 12, endDate: "2026-11-05" });
  await s.setProgress(null, stale, 12, "typed"); // adds it to the library (clamped to 12 at most)
  assert.equal((await s.setKnownAired(stale, 15)).ok, true);
  // the screen still holds the AniList copy (no knownAired): +1 must be allowed up to 15 anyway
  const r = await s.setProgress(null, stale, 13, "plus");
  assert.equal(r.progress, 13);
  assert.equal(r.reachedEnd, false); // total is unknown now, so no "finished" prompt at 12/12
  assert.equal((await s.getEntry("anime", 6)).item.knownAired, 15);
  // a fresh, complete copy replaces the saved item: the override stays
  await s.setProgress(null, { ...stale, synopsis: "x" }, 14, "plus");
  assert.equal((await s.getEntry("anime", 6)).item.knownAired, 15);
  // beyond what you said is out: stopped
  assert.equal((await s.setProgress(null, stale, 99, "typed")).progress, 15);
  // Reset
  await s.setKnownAired(stale, null);
  assert.equal((await s.getEntry("anime", 6)).item.knownAired, undefined);
  assert.equal((await s.setKnownAired(stale, 0)).ok, false);
});

test("once AniList counts as many as you said, the episodes-out number goes away by itself", async () => {
  const item = anime(7, { finished: true, episodes: 12, endDate: "2026-11-05" });
  await s.setProgress(null, item, 12, "typed");
  await s.setKnownAired(item, 16);
  // AniList still says 12 in total: keep it
  await s.noteAiring({ 7: { ...item } });
  assert.equal((await s.getEntry("anime", 7)).item.knownAired, 16);
  // AniList corrects its total to 16: it is right now, the number isn't needed
  await s.noteAiring({ 7: { ...item, episodes: 16 } });
  assert.equal((await s.getEntry("anime", 7)).item.knownAired, undefined);
});

test("a countdown from AniList deletes the episodes-out number too, and none can be set next to one", async () => {
  const item = anime(8, { finished: true, episodes: 12, endDate: "2026-11-05" });
  await s.setProgress(null, item, 12, "typed");
  await s.setKnownAired(item, 16);
  const counting = { ...item, finished: false, episodes: null, nextEpisode: { episode: 14, airingAt: hrs(48) } }; // AniList: 13 out, 14 coming
  // before anything is saved the number already has no effect
  assert.equal(s.airedFor({ ...(await s.getEntry("anime", 8)).item, ...counting }, NOW), 13);
  await s.noteAiring({ 8: counting });
  assert.equal((await s.getEntry("anime", 8)).item.knownAired, undefined);
  assert.deepEqual(await s.setKnownAired(counting, 20), { ok: false, reason: "anilist" });
  assert.equal((await s.setKnownAired(counting, null)).ok, true); // clearing is always fine
});

test("alerts for entered episodes: the next one, weekly ones after it, none once AniList has a countdown", async () => {
  const item = anime(9, { finished: true, episodes: 2000, endDate: "2020-01-01" });
  await s.setProgress(null, item, 2000, "typed");
  await s.setManualNext(item, { episode: 2001, airingAt: hrs(48), weekly: true });
  const lib = { "anime:9": await s.getEntry("anime", 9) };
  const rows = s.manualAlerts(lib, {}, NOW);
  assert.deepEqual(rows.map((r) => [r.item.id, r.episode, r.airingAt]), [2001, 2002, 2003, 2004].map((ep, i) => [9, ep, hrs(48) + i * 7 * 86400]));
  // AniList now has a countdown for it: no alert of ours
  assert.deepEqual(s.manualAlerts(lib, { 9: { ...item, finished: false, nextEpisode: { episode: 2001, airingAt: hrs(72) } } }, NOW), []);
  // not weekly: just the one
  await s.setManualNext(item, { episode: 2001, airingAt: hrs(48), weekly: false });
  assert.equal(s.manualAlerts({ "anime:9": await s.getEntry("anime", 9) }, {}, NOW).length, 1);
  // not a followed show (Completed): no alerts
  assert.deepEqual(s.manualAlerts({ "anime:9": { ...(await s.getEntry("anime", 9)), status: "completed" } }, {}, NOW), []);
});

// ---- AniList thinks the show ended at 2000; you know 2001 airs Sunday
const { parseLocalDateTime } = await import("../lib/format.js");

test("parseLocalDateTime reads your local time and rejects nonsense", () => {
  assert.equal(parseLocalDateTime("2026-11-15 23:30"), Math.floor(new Date(2026, 10, 15, 23, 30).getTime() / 1000));
  assert.equal(parseLocalDateTime("2026-11-15T23:30"), parseLocalDateTime("2026-11-15 23:30"));
  assert.equal(parseLocalDateTime("2026-02-31 10:00"), null);
  assert.equal(parseLocalDateTime("soon"), null);
});

test("a finished-on-AniList show gets a countdown from the next episode you entered, and keeps going weekly", async () => {
  const op = anime(2000, { finished: true, episodes: 2000, endDate: "2020-01-01", nextEpisode: null }); // long past the 14-day wrap-up
  await s.setProgress(null, op, 2000, "typed");
  const entry0 = await s.getEntry("anime", 2000);
  // nothing entered: it is not on Schedule at all
  assert.equal(s.yourShows({ "anime:2000": entry0 }, {}, NOW).length, 0);

  const sunday = hrs(48);
  assert.equal((await s.setManualNext(op, { episode: 2001, airingAt: sunday, weekly: true })).ok, true);
  const lib = { "anime:2000": await s.getEntry("anime", 2000) };
  let [row] = s.yourShows(lib, {}, NOW);
  assert.equal(row.next.episode, 2001);                 // countdown to 2001
  assert.equal(row.pending, 0);                         // caught up → shows in Anime this week, not Pending

  // AniList still says "finished" on refresh: the entry is kept
  await s.noteAiring({ 2000: { ...op, nextEpisode: null } });
  assert.equal((await s.getEntry("anime", 2000)).item.manualNext.episode, 2001);

  // it has aired (a day later): 2001 is out and unwatched → Pending, and 2002 counts down a week after
  const later = NOW + 3 * 86400e3;
  [row] = s.yourShows({ "anime:2000": await s.getEntry("anime", 2000) }, {}, later);
  assert.equal(row.pending, 1);
  assert.equal(row.next.episode, 2002);
  assert.equal(row.next.airingAt, sunday + 7 * 86400);

  // not weekly: no guessed next episode
  await s.setManualNext(op, { episode: 2001, airingAt: sunday, weekly: false });
  [row] = s.yourShows({ "anime:2000": await s.getEntry("anime", 2000) }, {}, later);
  assert.equal(row.pending, 1);
  assert.equal(row.next, null);
});

test("weekly guesses stop at the known total, and AniList's own next episode wins", async () => {
  const item = anime(30, { episodes: 12, finished: false, manualNext: { episode: 11, airingAt: hrs(-24 * 7 - 1), weekly: true } });
  // 11 aired a week ago, 12 aired an hour ago: nothing left to guess
  assert.deepEqual(s.manualNextState(item, NOW), { aired: 12, next: null });
  // AniList has a real next episode: it is used, not ours
  const real = { ...item, manualNext: { episode: 20, airingAt: hrs(24), weekly: true }, nextEpisode: { episode: 15, airingAt: hrs(72) } };
  const [row] = s.yourShows({ "anime:30": entry(real, "watching", 0) }, {}, NOW);
  assert.equal(row.next.episode, 15);
});

test("once AniList lists the episode you entered, your entry is dropped", async () => {
  const item = anime(31, { finished: true, episodes: 100, endDate: "2020-01-01" });
  await s.setProgress(null, item, 100, "typed");
  await s.setManualNext(item, { episode: 101, airingAt: hrs(24) });
  await s.noteAiring({ 31: { ...item, finished: false, nextEpisode: { episode: 101, airingAt: hrs(24) } } });
  const e = await s.getEntry("anime", 31);
  assert.equal(e.item.manualNext, undefined);
  assert.equal(e.item.nextEpisode.episode, 101);
});

// ---- AniList always wins: you can't add next to its countdown, and its countdown removes yours
test("you enter Sunday for 2001, AniList then says Monday: yours is gone, the countdown is AniList's, and you can't add another", async () => {
  const op = anime(40, { finished: true, episodes: 2000, endDate: "2020-01-01", nextEpisode: null });
  await s.setProgress(null, op, 2000, "typed");
  const sunday = hrs(48), monday = hrs(72);
  assert.equal((await s.setManualNext(op, { episode: 2001, airingAt: sunday })).ok, true);
  assert.equal(s.yourShows({ "anime:40": await s.getEntry("anime", 40) }, {}, NOW)[0].next.airingAt, sunday);

  // AniList's refresh arrives: same episode, a different day
  const anilist = { ...op, finished: false, nextEpisode: { episode: 2001, airingAt: monday } };
  // even before it is saved, a fresh AniList copy beats the saved manual one
  assert.equal(s.yourShows({ "anime:40": await s.getEntry("anime", 40) }, { 40: anilist }, NOW)[0].next.airingAt, monday);
  await s.noteAiring({ 40: anilist });
  const saved = await s.getEntry("anime", 40);
  assert.equal(saved.item.manualNext, undefined);
  assert.equal(saved.item.nextEpisode.airingAt, monday);
  assert.equal(s.yourShows({ "anime:40": saved }, {}, NOW)[0].next.airingAt, monday);

  // with AniList's countdown running nothing can be added, from a fresh copy or from the saved one
  assert.deepEqual(await s.setManualNext(anilist, { episode: 2001, airingAt: sunday }), { ok: false, reason: "anilist" });
  assert.deepEqual(await s.setManualNext(op, { episode: 2001, airingAt: sunday }), { ok: false, reason: "anilist" });
  assert.equal((await s.getEntry("anime", 40)).item.manualNext, undefined);
});

test("any AniList countdown removes your entry, even for a different episode number", async () => {
  const item = anime(41, { finished: true, episodes: 100, endDate: "2020-01-01" });
  await s.setProgress(null, item, 100, "typed");
  await s.setManualNext(item, { episode: 105, airingAt: hrs(24) });
  await s.noteAiring({ 41: { ...item, finished: false, nextEpisode: { episode: 101, airingAt: hrs(96) } } });
  assert.equal((await s.getEntry("anime", 41)).item.manualNext, undefined);
});

test("once AniList's countdown has run out and it has nothing next, you can enter one again", async () => {
  const real = Math.floor(Date.now() / 1000); // the store checks the real clock
  const item = anime(42, { finished: false, episodes: 2000, nextEpisode: { episode: 2001, airingAt: real - 5 * 3600 } }); // aired 5 hours ago
  await s.setProgress(null, item, 2000, "typed");
  assert.equal((await s.setManualNext(item, { episode: 2002, airingAt: real + 160 * 3600 })).ok, true);
});

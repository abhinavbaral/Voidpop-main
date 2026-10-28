import { test } from "node:test";
import assert from "node:assert/strict";
import { pendingView, oldestPending } from "../features/widgetPending.js";
import { yourShows } from "../backend/store.js";

const NOW = Date.UTC(2026, 9, 27, 12) ; // a fixed "now" (ms)
const S = NOW / 1000;
const DAY = 86400;
// a followed anime: `progress` watched, `nextEp` airs `nextIn` seconds from now
const entry = (id, title, { status = "watching", progress = 0, nextEp = null, nextIn = 3 * DAY, finished = false, skipped, endedDaysAgo } = {}) => ({
  status, progress, ...(skipped ? { skipped } : {}),
  item: {
    id, segment: "anime", title, image: `https://img/${id}.jpg`, finished, episodes: finished ? 12 : null,
    endDate: endedDaysAgo != null ? new Date(NOW - endedDaysAgo * DAY * 1000).toISOString().slice(0, 10) : null,
    nextEpisode: nextEp ? { episode: nextEp, airingAt: S + nextIn } : null,
  },
});
const lib = (...entries) => Object.fromEntries(entries.map((e) => [`anime:${e.item.id}`, e]));
const behindOf = (library) => yourShows(library, {}, NOW).filter((x) => x.pending > 0 && x.entry.status === "watching");

test("Pending view: ongoing shows with their pending count and next episode; finished You're watching shows are left out", () => {
  const library = lib(
    entry(1, "Airing A", { progress: 3, nextEp: 8, nextIn: 2 * DAY }),                     // 4 pending, next ep 8
    entry(2, "Airing B", { progress: 6, nextEp: 8, nextIn: 1 * DAY }),                     // 1 pending
    entry(3, "Plan to watch", { status: "plan", nextEp: 8, nextIn: 4 * DAY }),             // upcoming only
    entry(4, "Caught up", { progress: 7, nextEp: 8, nextIn: 3 * DAY }),                    // upcoming only
    entry(5, "Binging an old show", { progress: 2, finished: true, endedDaysAgo: 200 }),   // You're watching: left out
    entry(6, "Just finished", { progress: 9, finished: true, endedDaysAgo: 5 }),           // still on the Schedule: 3 pending, nothing next
    entry(7, "Rewatch", { status: "rewatching", progress: 1, nextEp: 8 }),                 // Rewatching: left out
  );
  const v = pendingView(yourShows(library, {}, NOW), [], NOW);
  assert.deepEqual(v.rows.map((r) => [r.title, r.pending, r.next?.episode ?? null]),
    [["Airing A", 4, 8], ["Just finished", 3, null], ["Airing B", 1, 8], ["Caught up", 0, 8], ["Plan to watch", 0, 8]]); // pending first, then by next episode
  assert.equal(v.total, 8);
  assert.equal(v.pendingShows, 3);
});

test("Pending view: Excited anime that haven't premiered are upcoming rows; nothing to show gives no rows", () => {
  const excited = [{ id: 50, title: "Premiere", image: null, nextEpisode: { episode: 1, airingAt: S + 5 * DAY } }, { id: 51, title: "Old", nextEpisode: { episode: 1, airingAt: S - DAY } }];
  const v = pendingView([], excited, NOW);
  assert.deepEqual(v.rows.map((r) => r.title), ["Premiere"]);
  assert.deepEqual(pendingView([], [], NOW), { total: 0, pendingShows: 0, rows: [] });
  assert.equal(oldestPending([]).oldest, null);
});

test("Pending view: the list is limited to 30", () => {
  const library = lib(...Array.from({ length: 40 }, (_, i) => entry(100 + i, `Show ${i}`, { progress: 0, nextEp: 3 + (i % 5) })));
  assert.equal(pendingView(yourShows(library, {}, NOW), [], NOW).rows.length, 30);
});

test("oldest: the show whose first unwatched episode aired longest ago, from exact air times", () => {
  const library = lib(
    entry(1, "A", { progress: 4, nextEp: 9 }),   // first unwatched: ep 5
    entry(2, "B", { progress: 7, nextEp: 9 }),   // ep 8
  );
  const aired = { "1:5": S - 30 * DAY, "2:8": S - 2 * DAY };
  const r = oldestPending(behindOf(library), aired);
  assert.deepEqual([r.oldest.title, r.oldest.episode, r.oldest.airedAt, r.oldest.estimated], ["A", 5, S - 30 * DAY, false]);
  assert.deepEqual(r.rows.map((x) => x.title), ["A", "B"]); // the pager goes through them oldest first
  assert.deepEqual(r.then.map((x) => x.title), ["B"]);
  assert.equal(r.total, 4 + 1);
});

test("oldest: with no exact time it works one out from the next episode, weekly, and says so", () => {
  const library = lib(entry(1, "A", { progress: 5, nextEp: 9, nextIn: 2 * DAY })); // ep 6 is 3 weeks before ep 9 → 3w - 2d ago... airs at next - 3 weeks
  const r = oldestPending(behindOf(library), {});
  assert.equal(r.oldest.episode, 6);
  assert.equal(r.oldest.airedAt, S + 2 * DAY - 3 * 7 * DAY);
  assert.equal(r.oldest.estimated, true);
});

test("oldest: skipped episodes are not 'waiting'; shows with no known time go last", () => {
  const library = lib(
    entry(1, "Skips the next", { progress: 2, nextEp: 6, skipped: [[3, 3]] }), // ep 3 skipped, so the first to watch is 4
    entry(2, "No schedule", { progress: 0, finished: true, endedDaysAgo: 3 }),   // finished, no next episode, no time known
    entry(3, "Newer", { progress: 4, nextEp: 6 }),
  );
  const aired = { "1:4": S - 9 * DAY, "3:5": S - 1 * DAY };
  const r = oldestPending(behindOf(library), aired);
  assert.equal(r.oldest.episode, 4);
  assert.deepEqual([r.oldest.title, ...r.then.map((x) => x.title)], ["Skips the next", "Newer", "No schedule"]); // the one with no known time is last
  const all = oldestPending(behindOf(library), aired);
  assert.equal(all.count, 3);
});

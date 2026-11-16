import { test } from "node:test";
import assert from "node:assert/strict";
import { weekSummary, libraryStats } from "../features/summaries.js";

const NOW = new Date(2026, 10, 13, 15, 0).getTime(); // Fri 13 Nov 2026, 15:00 local
const at = (daysAgo, h = 12) => new Date(2026, 10, 13 - daysAgo, h).getTime();

test("week summary counts progress per day and ignores status changes, old rows and the future", () => {
  const log = [
    [at(0, 9), "anime:1", 2, "plus"], [at(0, 10), "anime:2", 1, "plus"],
    [at(1), "manga:5", 3, "plus"], [at(6, 8), "anime:1", 1, "plus"],
    [at(7), "anime:1", 9, "plus"],                 // 8 days ago: outside
    [at(0, 11), "anime:1", 0, "status:completed"], // a status change, not progress
    [at(2), "anime:1", -1, "undo"],                // undo
    [NOW + 3600e3, "anime:3", 4, "plus"],          // later today than now: ignored
  ];
  const w = weekSummary(log, NOW);
  assert.equal(w.total, 7);
  assert.equal(w.titles, 3);
  assert.deepEqual(w.days.map((d) => d.count), [1, 0, 0, 0, 0, 3, 3]);
  assert.equal(w.days[6].today, true);
  assert.equal(w.days[6].label, "Fri");
});
test("week summary of nothing", () => {
  assert.deepEqual(weekSummary([], NOW).days.map((d) => d.count), [0, 0, 0, 0, 0, 0, 0]);
  assert.equal(weekSummary(undefined, NOW).total, 0);
});
test("library stats", () => {
  const s = libraryStats([{ status: "completed", addedAt: at(0) }, { status: "watching", addedAt: new Date(2025, 5, 1).getTime() }, { status: "rewatching" }], NOW);
  assert.deepEqual(s, { titles: 3, done: 2, thisYear: 1 });
});

import { weekAhead, continueList } from "../features/summaries.js";
test("week ahead counts what lands in 7 days, across kinds, soonest first", () => {
  const nowS = NOW / 1000, d = (n) => nowS + n * 86400;
  const e = (status, item) => ({ status, item });
  const w = weekAhead([
    e("watching", { segment: "anime", title: "A", nextEpisode: { airingAt: d(5) } }),
    e("plan", { segment: "game", title: "G", releaseAt: d(2) }),
    e("watching", { segment: "comic", title: "C", nextIssue: { airingAt: d(6.9) } }),
    e("watching", { segment: "anime", title: "late", nextEpisode: { airingAt: d(8) } }),
    e("watching", { segment: "anime", title: "past", nextEpisode: { airingAt: d(-1) } }),
    e("completed", { segment: "anime", title: "done", nextEpisode: { airingAt: d(1) } }),
    e("dropped", { segment: "game", title: "dropped", releaseAt: d(1) }),
  ], NOW);
  assert.equal(w.count, 3);
  assert.equal(w.next.item.title, "G");
  assert.deepEqual(weekAhead([], NOW), { count: 0, next: null });
});
test("continue list: only in-progress titles, newest touch first, capped", () => {
  const e = (status, t, at) => ({ status, item: { title: t }, updatedAt: at });
  const l = continueList([e("watching", "old", "2026-01-01"), e("plan", "no", "2026-12-01"), e("rewatching", "new", "2026-11-01"), e("completed", "no2", "2026-12-02")], 8);
  assert.deepEqual(l.map((x) => x.item.title), ["new", "old"]);
  assert.equal(continueList(Array.from({ length: 12 }, (_, i) => e("watching", String(i), `2026-01-${10 + i}`))).length, 8);
});

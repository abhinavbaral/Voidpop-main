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

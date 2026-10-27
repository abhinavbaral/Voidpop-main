import { test } from "node:test";
import assert from "node:assert/strict";
import { memoryStorage } from "./helpers.js";

const at = (d, h) => new Date(2026, 8, d, h, 0).getTime(); // September 2026, local time
const it = (id, extra = {}) => ({ id, segment: "anime", title: `T${id}`, finished: true, episodes: 12, ...extra });
memoryStorage({ "voidation:db:v1": JSON.stringify({
  library: {
    "anime:1": { status: "completed", progress: 12, item: it(1), updatedAt: "2026-09-10T00:00:00Z" },
    "anime:2": { status: "watching", progress: 14, item: it(2, { episodes: 24 }), updatedAt: "2026-09-10T00:00:00Z", rewatches: 1 },
  },
  reviews: { "anime:1": { segment: "anime", titleId: 1, verdict: "peak", vibes: [], moods: [], comment: "", date: "2026-09-10T00:00:00Z" } },
  // 8 days in a row (1st–8th), 13 episodes on the 3rd, 3 of them after midnight
  log: [
    ...[1, 2, 4, 5, 6, 7, 8].map((d) => [at(d, 20), "anime:2", 1, "plus"]),
    [at(3, 1), "anime:2", 3, "plus"], [at(3, 20), "anime:2", 10, "typed"],
    [at(12, 9), "anime:2", 0, "status:watching"], // a status change isn't watching
    [at(20, 9), "anime:1", 12, "complete"], // filled in by Completed: not counted
  ],
  categories: [], excited: {}, settings: {}, notes: {}, meta: {},
}) });

const { computeAchievements, longestStreak, levelFor } = await import("../features/achievements.js");
const { getLog } = await import("../backend/store.js");

test("levelFor: how many goals a count has reached", () => {
  const days = [1, 7, 15, 30, 90];
  assert.equal(levelFor(0, days), 0);
  assert.equal(levelFor(1, days), 1);
  assert.equal(levelFor(6, days), 1);
  assert.equal(levelFor(7, days), 2);
  assert.equal(levelFor(30, days), 4);
  assert.equal(levelFor(500, days), 5);
});

test("achievements: leveled streak, bingeing, night owl, firsts", async () => {
  assert.equal(longestStreak(await getLog()), 8);
  const list = await computeAchievements();
  const a = Object.fromEntries(list.map((x) => [x.key, x]));
  // 8 days in a row: past level 2 (7 days), working towards level 3 (15 days)
  assert.equal(a.blaze.level, 2);
  assert.equal(a.blaze.maxLevel, 5);
  assert.equal(a.blaze.have, 8);
  assert.equal(a.blaze.need, 15);
  assert.equal(a.blaze.done, false);
  assert.equal(a.blaze.earned, true);
  assert.equal(a.binger.have, 12); // 13 in a day, capped at the goal
  assert.equal(a.binger.done, true);
  assert.equal(a.owl.have, 3);
  assert.deepEqual([a.consumer.have, a.consumer.need, a.consumer.done], [1, 5, false]); // renamed from Junior: 5 finished titles of any kind
  assert.equal(a.junior, undefined);
  assert.equal(a.cinemaLover.level, 0);  // no movies or TV yet
  assert.equal(a.peak.have, 1);
  assert.equal(a.otaku.have, 12 + 14);
  // retired: the three separate streak badges and Round Two
  for (const gone of ["week", "wildfire", "again"]) assert.equal(a[gone], undefined);
  // one completed title = still Newbie: rank 1 of 15, next goal is 5 ranks
  assert.equal(a.rankCollector.have, 1);
  assert.equal(a.rankCollector.level, 1);
  assert.equal(a.rankCollector.need, 5);
});

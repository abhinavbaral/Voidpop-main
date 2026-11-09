import { test } from "node:test";
import assert from "node:assert/strict";
import { memoryStorage } from "./helpers.js";

memoryStorage();
const { buildAnimeWeek } = await import("../features/animeWeek.js");
const { weekStart } = await import("../features/upcoming.js");

// Wednesday noon, so Monday and Tuesday are behind us and Thursday is ahead
const NOW = new Date(2026, 10, 11, 12, 0, 0).getTime();
const at = (day, hour) => Math.floor(new Date(2026, 10, day, hour, 0, 0).getTime() / 1000);
const item = (id, extra = {}) => ({ id, segment: "anime", title: `A${id}`, episodes: 24, finished: false, ...extra });
const ep = (it, episode, airingAt) => ({ item: it, episode, airingAt });
const entry = (it, status, progress = 0) => ({ item: it, status, progress });

test("weekStart is the Monday 00:00 of that week", () => {
  const w = weekStart(new Date(NOW));
  assert.equal(w.getDay(), 1);
  assert.equal(w.getDate(), 9);
  assert.equal(w.getHours(), 0);
  assert.equal(weekStart(new Date(2026, 10, 15, 23, 0)).getDate(), 9); // Sunday still belongs to that Monday's week
});

test("this week's episodes: today and later first, the days already gone separately; aired vs not yet", () => {
  const a = item(1, { nextEpisode: { episode: 6, airingAt: at(12, 20) } });
  const eps = [ep(a, 4, at(9, 20)), ep(a, 5, at(11, 8)), ep(a, 6, at(12, 20))];
  const w = buildAnimeWeek(eps, {}, NOW);
  assert.deepEqual(w.past.map((d) => d.date.getDate()), [9]);
  assert.deepEqual(w.upcoming.map((d) => d.date.getDate()), [11, 12]);
  assert.equal(w.upcoming[0].isToday, true);
  assert.equal(w.upcoming[0].rows[0].aired, true);   // 08:00 today has aired
  assert.equal(w.upcoming[1].rows[0].aired, false);  // Thursday 20:00 hasn't
  assert.equal(w.total, 3);
});

test("an aired episode counts as watched once your progress reaches it (or the show is Completed)", () => {
  const a = item(1, { nextEpisode: { episode: 6, airingAt: at(12, 20) } });
  const b = item(2, { nextEpisode: { episode: 3, airingAt: at(12, 20) } });
  const c = item(3, { nextEpisode: { episode: 3, airingAt: at(12, 20) } });
  const eps = [ep(a, 5, at(11, 8)), ep(b, 2, at(11, 9)), ep(c, 2, at(11, 10))];
  const lib = { "anime:1": entry(a, "watching", 5), "anime:2": entry(b, "watching", 1), "anime:3": entry(c, "completed", 24) };
  const rows = Object.fromEntries(buildAnimeWeek(eps, lib, NOW).upcoming[0].rows.map((r) => [r.item.id, r]));
  assert.equal(rows[1].watched, true);
  assert.equal(rows[2].watched, false);
  assert.equal(rows[3].watched, true);
});

test("older aired episodes you haven't watched stay (Watching only) until you watch them", () => {
  // aired 1-5 so far (6 is next); you've watched 2; episodes 5 aired this week, 3 and 4 before it
  const a = item(1, { nextEpisode: { episode: 6, airingAt: at(12, 20) } });
  const eps = [ep(a, 5, at(11, 8)), ep(a, 6, at(12, 20))];
  const w = buildAnimeWeek(eps, { "anime:1": entry(a, "watching", 2) }, NOW);
  assert.equal(w.earlier.length, 1);
  assert.equal(w.earlier[0].earlier, 2); // 3 and 4; episode 5 is in this week's list
  // watched up to 4: nothing from before this week is left
  assert.equal(buildAnimeWeek(eps, { "anime:1": entry(a, "watching", 4) }, NOW).earlier.length, 0);
  // Plan to Watch never carries over
  assert.equal(buildAnimeWeek(eps, { "anime:1": entry(a, "plan", 0) }, NOW).earlier.length, 0);
});

// The two-week rule: a finished show you are watching stays on Schedule for 14 days after
// its last episode, then moves to More > You're watching. Rewatching goes there at once.
import test from "node:test";
import assert from "node:assert/strict";
import * as s from "../backend/store.js";
const now = Date.parse("2026-10-14T12:00:00Z");
const mk = (id, status, item, progress = 0) => ({ item: { id, segment: "anime", title: "t" + id, ...item }, status, progress });
test("wrap-up rule", () => {
  const lib = {
    a: mk(1, "watching", { finished: true, episodes: 13, endDate: "2026-10-05" }),          // ended 9 days ago, missed -> stays on Schedule
    b: mk(2, "watching", { finished: true, episodes: 12, endDate: "2026-09-20" }),          // ended 24 days ago -> You're watching
    c: mk(3, "rewatching", { finished: true, episodes: 24, endDate: "2020-01-01" }),        // rewatch -> You're watching
    d: mk(4, "watching", { finished: false, episodes: 12, nextEpisode: { episode: 5, airingAt: now / 1000 + 86400 } }), // airing -> Schedule
    e: mk(5, "completed", { finished: true, episodes: 12, endDate: "2020-01-01" }),
  };
  const ids = (arr) => arr.map((x) => x.item.id).sort();
  assert.deepEqual(ids(s.yourShows(lib, {}, now)), [1, 4]);
  assert.deepEqual(ids(s.youreWatching(lib, now)), [2, 3]);
});

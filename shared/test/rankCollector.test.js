import { test } from "node:test";
import assert from "node:assert/strict";
import { memoryStorage } from "./helpers.js";

// One completed title (Newbie), but the Critic rank (5th) was already shown to this
// user earlier and they have since removed titles. A collected rank is never lost.
memoryStorage({ "voidation:db:v1": JSON.stringify({
  library: {
    "anime:1": { status: "completed", progress: 12, item: { id: 1, segment: "anime", title: "T1", finished: true, episodes: 12 }, updatedAt: "2026-09-10T00:00:00Z" },
  },
  reviews: {}, log: [], categories: [], excited: {}, settings: {}, notes: {},
  meta: { tierSeen: "critic", tierSeenV: 2 },
}) });

const { getRanksCollected } = await import("../backend/store.js");
const { computeAchievements } = await import("../features/achievements.js");

test("rank collector counts the highest rank you have reached, even after removing titles", async () => {
  assert.equal(await getRanksCollected(), 5);
  const rc = (await computeAchievements()).find((x) => x.key === "rankCollector");
  assert.equal(rc.level, 2); // 5 ranks = level 2
  assert.equal(rc.need, 8); // next goal
  assert.equal(rc.have, 5);
});

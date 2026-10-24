// "New seasons of shows you watched" (anime): the next season shows up even when it came out years ago.
import { test } from "node:test";
import assert from "node:assert/strict";
import { memoryStorage, fakeAniList, media, daysAgo } from "./helpers.js";

const mine = (id) => ({ status: "completed", progress: 12, item: { id, segment: "anime", title: `T${id}`, finished: true, episodes: 12 }, updatedAt: daysAgo(30) });
memoryStorage({ "voidation:db:v1": JSON.stringify({ library: {
  "anime:1": mine(1),   // watched Season 1; Season 2 came out in 2019, a recap film too, and a Season 3 is airing now
  "anime:10": mine(10), // watched Season 1; its Season 2 (11) is old, but you already have Season 3 (12)
  "anime:12": mine(12),
} }) });

const seq = (id, extra) => ({ relationType: "SEQUEL", node: media(id, { type: "ANIME", ...extra }) });
const sequels = {
  1: [seq(2, { startDate: { year: 2019, month: 4, day: 1 } }), seq(3, { startDate: { year: 2019, month: 9, day: 1 }, format: "MOVIE" }), seq(4, { status: "RELEASING", startDate: { year: 2026, month: 10, day: 1 } })],
  10: [seq(11, { startDate: { year: 2018, month: 1, day: 1 } })],
  11: [seq(12, { startDate: { year: 2020, month: 1, day: 1 } })],
  12: [],
};
fakeAniList((query, v) => ({ Page: { media: (v.ids || []).map((id) => ({ id, relations: { edges: sequels[id] || [] } })) } }));

const { loadNewSeasons } = await import("../features/explore.js");

test("new seasons: an old Season 2 you never started shows up (airing first); old films and seasons you've moved past don't", async () => {
  const out = await loadNewSeasons();
  assert.deepEqual(out.map((x) => x.id), [4, 2]);
  assert.equal(out[1].sequelOf, "T1");
});

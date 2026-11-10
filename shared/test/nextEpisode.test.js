import { test } from "node:test";
import assert from "node:assert/strict";
import { memoryStorage, fakeAniList, media } from "./helpers.js";
import { projectStale, reconcileNext, parseBroadcast, onSlot, airingPassedSince, WEEK_S } from "../features/nextEpisode.js";

memoryStorage();

// The real case: episode 7 aired Sat 7 Nov 2026 19:15 Nepal time (13:30 UTC = 22:30 Japan), looked at Mon 9 Nov 18:04 Nepal
const EP7 = Date.UTC(2026, 10, 7, 13, 30) / 1000;
const NOW = Date.UTC(2026, 10, 9, 12, 19);
const EP8 = EP7 + WEEK_S;

test("a passed countdown is carried forward a week, marked estimated", () => {
  assert.deepEqual(projectStale({ episode: 7, airingAt: EP7 }, { now: NOW }), { episode: 8, airingAt: EP8, estimated: true });
});
test("inside the Airing-now hour nothing moves; a time not yet passed is the same object", () => {
  const n = { episode: 8, airingAt: EP8 };
  assert.equal(projectStale(n, { now: EP8 * 1000 - 5000 }), n);
  assert.equal(projectStale(n, { now: EP8 * 1000 + 30 * 60e3 }), n);
  assert.equal(projectStale(n, { now: EP8 * 1000 + 61 * 60e3 }).episode, 9);
});
test("several missed weeks, and the end of the run", () => {
  assert.equal(projectStale({ episode: 7, airingAt: EP7 }, { now: (EP7 + 3 * WEEK_S + 100) * 1000 }).episode, 10);
  assert.equal(projectStale({ episode: 12, airingAt: EP7 }, { episodes: 12, now: NOW }), null);
  assert.equal(projectStale({ episode: 13, airingAt: EP7 }, { episodes: 12, now: NOW }).episode, 14); // a total that is wrong does not hide it
  assert.equal(projectStale(null), null);
});

test("weekly slot: Saturdays 22:30 Japan time", () => {
  const slot = parseBroadcast({ day: "Saturdays", time: "22:30", timezone: "Asia/Tokyo" });
  assert.ok(onSlot(slot, EP7) && onSlot(slot, EP8));
  assert.ok(!onSlot(slot, EP8 + 6 * 3600));
  assert.equal(parseBroadcast({ day: "Saturdays", time: "22:30", timezone: "Europe/London" }), null);
  assert.equal(parseBroadcast({ day: "Unknown", time: null }), null);
});

test("reconcile: fresh AniList wins untouched; agreeing sources add confidence", () => {
  const al = { episode: 8, airingAt: EP8 };
  assert.equal(reconcileNext({ anilist: al, now: NOW }), al);
  const slot = parseBroadcast({ day: "Saturdays", time: "22:30", timezone: "Asia/Tokyo" });
  const r = reconcileNext({ anilist: al, shikimori: { episode: 8, airingAt: EP8 + 300 }, slot, now: NOW });
  assert.deepEqual(r, { episode: 8, airingAt: EP8, confirmedBy: 3 });
  assert.equal(reconcileNext({ anilist: al, shikimori: { episode: 8, airingAt: EP8 + 86400 }, now: NOW }), al); // disagree: AniList stays
});
test("reconcile: stale AniList, fresh Shikimori -> Shikimori; both stale -> estimate; nothing -> null", () => {
  const stale = { episode: 7, airingAt: EP7 };
  assert.deepEqual(reconcileNext({ anilist: stale, shikimori: { episode: 8, airingAt: EP8 + 600 }, now: NOW }), { episode: 8, airingAt: EP8 + 600, source: "shikimori" });
  assert.deepEqual(reconcileNext({ anilist: stale, now: NOW }), { episode: 8, airingAt: EP8, estimated: true });
  assert.equal(reconcileNext({ now: NOW }), null);
});

test("saved answer: a countdown that ran out after saving is outdated, one already out when saved is not", () => {
  const data = { Page: { media: [{ nextAiringEpisode: { episode: 7, airingAt: EP7 } }] } };
  assert.equal(airingPassedSince(data, (EP7 - 3600) * 1000, NOW), true);
  assert.equal(airingPassedSince(data, (EP7 + 60) * 1000, NOW), false);
  assert.equal(airingPassedSince({ a: 1 }, 0, NOW), false);
});

const a = await import("../api/anilist.js");
const s = await import("../api/airingSources.js");
s.GAP_MS.shikimori = 0; s.GAP_MS.jikan = 0;

test("fetchNextEpisodes: AniList stale and unreachable others -> weekly estimate, never a passed time", async () => {
  const realNow = Date.now; Date.now = () => NOW;
  try {
    fakeAniList(() => ({ Page: { media: [media(1, { status: "RELEASING", idMal: 11, episodes: 12, nextAiringEpisode: { episode: 7, airingAt: EP7 } })] } }));
    const out = await a.fetchNextEpisodes([1]);
    assert.deepEqual(out[1].nextEpisode, { episode: 8, airingAt: EP8, estimated: true });
  } finally { Date.now = realNow; }
});

test("fetchNextEpisodes: Shikimori and the weekly slot confirm a good AniList time (verify)", async () => {
  const realNow = Date.now; Date.now = () => NOW;
  try {
    const gql = async () => ({ Page: { media: [media(2, { status: "RELEASING", idMal: 22, episodes: 12, nextAiringEpisode: { episode: 8, airingAt: EP8 } })] } });
    globalThis.fetch = async (url, opts) => {
      const json = url.includes("shikimori") ? { next_episode_at: new Date(EP8 * 1000).toISOString(), episodes_aired: 7, episodes: 12 }
        : url.includes("jikan") ? { data: { broadcast: { day: "Saturdays", time: "22:30", timezone: "Asia/Tokyo" } } }
        : { data: await gql(JSON.parse(opts.body)) };
      return { ok: true, status: 200, headers: { get: () => null }, json: async () => json };
    };
    const out = await a.fetchNextEpisodes([2], { verify: true });
    assert.equal(out[2].nextEpisode.confirmedBy, 3);
    assert.equal(out[2].nextEpisode.airingAt, EP8);
  } finally { Date.now = realNow; }
});

test("other sources failing never throws and never changes a good AniList time", async () => {
  const realNow = Date.now; Date.now = () => NOW;
  try {
    globalThis.fetch = async (url, opts) => {
      if (!url.includes("graphql")) throw new Error("down");
      return { ok: true, status: 200, headers: { get: () => null }, json: async () => ({ data: { Page: { media: [media(3, { status: "RELEASING", idMal: 33, nextAiringEpisode: { episode: 8, airingAt: EP8 } })] } } }) };
    };
    const out = await a.fetchNextEpisodes([3], { verify: true });
    assert.deepEqual(out[3].nextEpisode, { episode: 8, airingAt: EP8 });
  } finally { Date.now = realNow; }
});

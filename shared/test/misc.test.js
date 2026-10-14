import { test } from "node:test";
import assert from "node:assert/strict";
import { gzipSync, strToU8 } from "fflate";
import { memoryStorage, daysAgo } from "./helpers.js";

const now = Date.now();
const it = (id, seg, extra = {}) => ({ id, segment: seg, title: `T${id}`, finished: true, episodes: 12, ...extra });
memoryStorage({ "voidation:db:v1": JSON.stringify({ library: {
  "anime:1": { status: "watching", progress: 5, item: it(1, "anime"), updatedAt: daysAgo(10, now) },
  "anime:2": { status: "watching", progress: 5, item: it(2, "anime"), updatedAt: daysAgo(1, now) },
  "anime:3": { status: "onhold", progress: 3, item: it(3, "anime"), updatedAt: daysAgo(5, now) },
  "anime:4": { status: "watching", progress: 12, item: it(4, "anime"), updatedAt: daysAgo(20, now) },
  "manga:6": { status: "watching", progress: 40, item: it(6, "manga", { episodes: null, finished: false }), updatedAt: daysAgo(8, now) },
} }) });

const { parseMalXml, malFileToText } = await import("../features/malImport.js");
const { loadJumpBackIn } = await import("../features/explore.js");
const { hypeLabel, formatCountdown } = await import("../lib/format.js");
const { readableAccent, contrast, parseHex } = await import("../lib/color.js");

test("Jump back in: started, left 3+ days, something left; most recent first", async () => {
  const r = await loadJumpBackIn(now);
  assert.deepEqual(r.anime.map((x) => x.id), [3, 1]);
  assert.deepEqual(r.manga, []); // Explore is anime only
});

test("MAL export: words and numbers, rewatching flag, gzip", () => {
  const xml = `<myanimelist>
    <anime><series_animedb_id>21</series_animedb_id><series_title><![CDATA[One Piece]]></series_title><my_watched_episodes>1100</my_watched_episodes><my_status>Watching</my_status><my_rewatching>0</my_rewatching></anime>
    <anime><series_animedb_id>5</series_animedb_id><my_watched_episodes>12</my_watched_episodes><my_status>2</my_status><my_times_watched>1</my_times_watched><my_rewatching>1</my_rewatching></anime>
    <manga><manga_mangadb_id>13</manga_mangadb_id><my_read_chapters>50</my_read_chapters><my_status>Plan to Read</my_status></manga>
  </myanimelist>`;
  const p = parseMalXml(xml);
  assert.deepEqual(p.anime.map((x) => [x.malId, x.status, x.progress]), [[21, "watching", 1100], [5, "rewatching", 12]]);
  assert.equal(p.anime[0].title, "One Piece");
  assert.equal(p.manga[0].status, "plan");
  assert.equal(malFileToText(gzipSync(strToU8(xml))), xml);
});

test("hype label", () => {
  assert.equal(hypeLabel(12400), "12.4k following");
  assert.equal(hypeLabel(3000), "3k following");
  assert.equal(hypeLabel(1200000), "1.2M following");
  assert.equal(hypeLabel(0), null);
});

test("countdown wording", () => {
  const t = Math.floor(now / 1000);
  assert.equal(formatCountdown(t + 2 * 86400 + 3 * 3600, now), "2d 3h");
  assert.equal(formatCountdown(t + 3600 + 5 * 60, now), "1h 05m");
  assert.equal(formatCountdown(t - 60, now), "Airing now");
});

test("cover accent stays readable on dark, light and under white text", () => {
  for (const hex of ["#0d0d0d", "#fefefe", "#1a4e86", "#e4a15d", "#f1e4ae"]) {
    const rgb = parseHex(readableAccent(hex, "#a855f7"));
    assert.ok(contrast(rgb, [11, 15, 25]) >= 3, `${hex} on dark`);
    assert.ok(contrast(rgb, [255, 255, 255]) >= 3, `${hex} with white`);
  }
  assert.equal(readableAccent(null, "#a855f7"), "#a855f7");
});

test("ranks: 15 in order; old 'seen' ranks map by titles needed; Voidmon's verdict questions", async () => {
  const s = await import("../backend/store.js");
  const mins = s.TIERS.map((t) => t.min);
  assert.equal(s.TIERS.length, 15);
  assert.deepEqual([...mins].sort((a, b) => a - b), mins);
  assert.equal(s.tierFor(0).key, "newbie");
  assert.equal(s.tierFor(4).key, "newbie");
  assert.equal(s.tierFor(5).key, "rookie");
  assert.equal(s.tierFor(9999).key, "addicted");
  // old list: "elite" needed 300 → new Relentless Watcher (300), not the new Elite (700)
  assert.equal(s.TIERS[s.seenTierIndex({ tierSeen: "elite" })].key, "relentless");
  assert.equal(s.TIERS[s.seenTierIndex({ tierSeen: "rookie" })].key, "newbie");
  assert.equal(s.TIERS[s.seenTierIndex({ tierSeen: "elite", tierSeenV: 2 })].key, "elite");
  assert.equal(s.seenTierIndex({}), -1);

  const { verdictPrompt } = await import("../features/voidmon.js");
  assert.equal(verdictPrompt({}).pose, "asking");
  assert.match(verdictPrompt({}).text, /Void Verdict/);
  assert.match(verdictPrompt({ step: "feel" }).text, /feeling/);
  assert.equal(verdictPrompt({ step: "feel", moods: ["Happy"] }).pose, "celebrating");
});


// Best out there, Popular in town and Most loved from community verdict counts (no network).
import { test } from "node:test";
import assert from "node:assert/strict";
import { memoryStorage } from "./helpers.js";

memoryStorage();
const { shares, rankCommunity } = await import("../features/communityRank.js");

const t = (segment, id, peak, divein = 0, onetime = 0, voidit = 0) => ({ segment, id, title: `${segment} ${id}`, image: `/${id}.jpg`, counts: { peak, divein, onetime, voidit } });
const ids = (list) => list.map((it) => `${it.segment}:${it.id}`);

test("shares: fractions of everyone who gave a verdict; nobody means zeros", () => {
  assert.deepEqual(shares({ peak: 6, divein: 2, onetime: 1, voidit: 1 }), { total: 10, peak: 0.6, peakDivein: 0.8, notVoid: 0.9 });
  assert.deepEqual(shares({}), { total: 0, peak: 0, peakDivein: 0, notVoid: 0 });
  assert.deepEqual(shares(null), { total: 0, peak: 0, peakDivein: 0, notVoid: 0 });
});

test("Most loved needs 99% Peak or Dive In; Best out there needs 70% Peak and never repeats a Most loved title", () => {
  const r = rankCommunity([
    t("anime", 1, 100),               // 100% peak → loved only
    t("anime", 2, 70, 29, 1),         // 99% peak or dive in → loved (also 70% peak, but not repeated in best)
    t("anime", 3, 70, 10, 10, 10),    // 70% peak, 80% peak or dive in → best
    t("anime", 4, 69, 31),            // 69% peak, 100% peak or dive in → loved
    t("anime", 5, 69, 10, 11, 10),    // 69% peak, 79% → neither best nor loved
  ]);
  assert.deepEqual(ids(r.loved).sort(), ["anime:1", "anime:2", "anime:4"]);
  assert.deepEqual(ids(r.best), ["anime:3"]);
  assert.ok(!ids(r.best).some((k) => ids(r.loved).includes(k)));
});

test("Popular in town: 70%+ not Void It, the most-voted first", () => {
  const r = rankCommunity([t("movie", 1, 50, 0, 0, 50), t("movie", 2, 10, 10, 10, 30), t("movie", 3, 90, 10, 0, 0), t("movie", 4, 30, 30, 20, 20), t("movie", 5, 40, 40, 0, 0)]);
  // 1 and 2 are half Void It, so out; 3 and 4 (100 votes each) beat 5 (80 votes); 3 is the friendlier of 3 and 4
  assert.deepEqual(ids(r.popular), ["movie:3", "movie:4", "movie:5"]);
});

test("a title needs MIN_VERDICTS counted verdicts: 19 unanimous votes still don't count", () => {
  const r = rankCommunity([t("tv", 1, 19), t("tv", 2, 20)]);
  assert.deepEqual(ids(r.loved), ["tv:2"]);
  assert.deepEqual(ids(rankCommunity([t("tv", 1, 3)], { min: 3 }).loved), ["tv:1"]); // lowered for tests
});

test("every row mixes the kinds in turn; titles with no name or no id are skipped", () => {
  const list = [t("anime", 1, 40), t("anime", 2, 30), t("manga", 3, 25), t("novel", 4, 24), t("movie", 5, 22), t("tv", 6, 21), { ...t("tv", 7, 50), title: "" }, { segment: "tv", title: "x", counts: { peak: 50 } }];
  const r = rankCommunity(list);
  assert.deepEqual(ids(r.loved), ["anime:1", "manga:3", "novel:4", "movie:5", "tv:6", "anime:2"]);
  assert.equal(r.loved[0].imageSmall, "/1.jpg");
  assert.deepEqual(rankCommunity([]), { best: [], popular: [], loved: [] });
  assert.deepEqual(rankCommunity(undefined), { best: [], popular: [], loved: [] });
});

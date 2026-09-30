import { test } from "node:test";
import assert from "node:assert/strict";
import { memoryStorage } from "./helpers.js";

const it = (id, extra = {}) => ({ id, segment: "anime", title: `T${id}`, finished: true, episodes: 12, genres: ["Action"], ...extra });
memoryStorage({ "voidation:db:v1": JSON.stringify({
  library: {
    "anime:1": { status: "completed", progress: 12, item: it(1), updatedAt: "2026-03-01T00:00:00Z", rewindYear: 2026 },
    "anime:2": { status: "completed", progress: 12, item: it(2), updatedAt: "2020-01-01T00:00:00Z" }, // imported, old
    "anime:3": { status: "watching", progress: 3, item: it(3), updatedAt: "2027-02-01T00:00:00Z", rewindYear: 2027 },
  },
  reviews: { "anime:1": { segment: "anime", titleId: 1, verdict: "peak", vibes: [], moods: [], comment: "", date: "2026-03-01T00:00:00Z" } },
  log: [], categories: [], excited: {}, settings: {}, notes: {}, meta: {},
}) });

const store = await import("../backend/store.js");
const w = await import("../wrapped.js");

test("Rewind: tabs are All time, Before <this year>, <this year>", async () => {
  assert.deepEqual(await w.wrappedYears(new Date(2027, 5, 1).getTime()), ["all", "before-2027", 2027]);
  assert.equal(w.wrappedLabel("before-2027"), "Before 2027");
});

test("Rewind: a year holds the titles picked for it; Before holds the rest", async () => {
  const y2026 = await w.computeWrapped(2026);
  assert.equal(y2026.picked, 1);
  assert.equal(y2026.completed, 1);
  assert.equal(y2026.episodes, 12); // picked, never marked episode by episode: counts in full
  assert.equal(y2026.verdictTotal, 1);

  const before2026 = await w.computeAllTime({ before: 2026 });
  assert.equal(before2026.titles, 1); // only the old import
  const before2027 = await w.computeAllTime({ before: 2027 });
  assert.equal(before2027.titles, 2); // last year's picks move into Before
  assert.equal(before2027.verdictTotal, 1);
  assert.equal((await w.computeAllTime()).titles, 3);
});

test("Rewind: titles you add get this year; imports don't; picks can change", async () => {
  const year = new Date().getFullYear();
  await store.setStatus(null, "anime", it(10), "watching");
  assert.equal((await store.getLibrary())["anime:10"].rewindYear, year);
  await store.importMalEntries([{ item: it(11), status: "completed", progress: 12, times: 0 }]);
  assert.equal((await store.getLibrary())["anime:11"].rewindYear, undefined);
  assert.equal(await store.setRewindYear(["anime:11"], year), 1);
  assert.equal((await store.getLibrary())["anime:11"].rewindYear, year);
  await store.setRewindYear(["anime:11"], null);
  assert.equal((await store.getLibrary())["anime:11"].rewindYear, 0); // off on purpose
});

test("Rewind: anything you're Watching counts this year by itself; rewatches and switched-off ones don't", async () => {
  const year = new Date().getFullYear();
  await store.importMalEntries([
    { item: it(20), status: "watching", progress: 2, times: 0 },
    { item: it(21), status: "rewatching", progress: 2, times: 1 },
  ]);
  const lib = await store.getLibrary();
  assert.equal(lib["anime:20"].rewindYear, year);
  assert.equal(lib["anime:21"].rewindYear, undefined);
  await store.setRewindYear(["anime:20"], null);
  await store.setProgress(null, it(20), 3);
  assert.equal((await store.getLibrary())["anime:20"].rewindYear, 0);
});

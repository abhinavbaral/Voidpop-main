import { test } from "node:test";
import assert from "node:assert/strict";
import { memoryStorage } from "./helpers.js";

memoryStorage();
const store = await import("../backend/store.js");
const { familiarFaces } = await import("../features/peopleStats.js");

const item = { id: 7, segment: "anime", title: "Seven Days", episodes: 12, finished: true };

test("changing a verdict keeps the earlier one in history; same verdict adds nothing", async () => {
  await store.setStatus(null, "anime", item, "completed");
  await store.addReview(null, "anime", 7, { verdict: "divein", vibes: ["Drama"], comment: "first take" });
  await store.addReview(null, "anime", 7, { verdict: "divein", vibes: ["Drama"], comment: "still the same" });
  let r = await store.getMyReview(null, "anime", 7);
  assert.equal(r.history, undefined);
  await store.addReview(null, "anime", 7, { verdict: "peak", vibes: ["Drama"], comment: "changed my mind" });
  r = await store.getMyReview(null, "anime", 7);
  assert.equal(r.verdict, "peak");
  assert.deepEqual(r.history.map((h) => h.verdict), ["divein"]);
  await store.addReview(null, "anime", 7, { verdict: "onetime", vibes: [], comment: "later" });
  r = await store.getMyReview(null, "anime", 7);
  assert.deepEqual(r.history.map((h) => h.verdict), ["divein", "peak"]);
});

test("markdown export: a section per title with verdict, vibes and the note", async () => {
  await store.setNote("anime", 7, "Stopped at the tournament arc\nGreat opening");
  const md = await store.exportLibraryMarkdown();
  assert.match(md, /^# VoidPop library/);
  assert.match(md, /## Seven Days/);
  assert.match(md, /- Status: Completed/);
  assert.match(md, /- Void Verdict: One Time/);
  assert.match(md, /> Stopped at the tournament arc\n> Great opening/);
});

test("familiar faces: other titles a person is credited on, planned and the open title left out", () => {
  const entries = [
    { status: "completed", item: { segment: "anime", id: 1 } },
    { status: "watching", item: { segment: "anime", id: 2 } },
    { status: "plan", item: { segment: "anime", id: 3 } },
    { status: "completed", item: { segment: "anime", id: 4 } },
  ];
  const credits = {
    "anime:1": { voices: [{ id: 100 }], staff: [{ id: 200 }] },
    "anime:2": { voices: [{ id: 100 }], staff: [] },
    "anime:3": { voices: [{ id: 100 }], staff: [] },
    "anime:4": { voices: [{ id: 100 }], staff: [{ id: 200 }] },
  };
  assert.deepEqual(familiarFaces(entries, credits, "anime:4"), { 100: 2, 200: 1 });
});

test("backups: new ones say voidpop; ones made before the rename still restore", async () => {
  const out = JSON.parse(await store.exportData());
  assert.equal(out.app, "voidpop");
  assert.equal(await store.importData(JSON.stringify({ ...out, app: "voidation" })), null);
  assert.equal(await store.importData(JSON.stringify({ ...out, app: "somethingelse" })), "That file isn't a VoidPop backup.");
});

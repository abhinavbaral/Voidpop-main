// History like YouTube's: one timeline of what you watched and what is waiting.
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildHistory, historyText, HISTORY_FILTERS } from "../features/history.js";

const day = 86400000;
const now = Date.parse("2026-10-18T15:00:00");
const anime = (id, title, extra = {}) => ({ id, segment: "anime", title, episodes: 12, ...extra });
const library = {
  "anime:1": { item: anime(1, "Death Note"), status: "watching", progress: 6 },
  "anime:2": { item: anime(2, "One Piece", { episodes: null }), status: "watching", progress: 40 },
  "manga:3": { item: { id: 3, segment: "manga", title: "Berserk", chapters: 300 }, status: "reading", progress: 150 },
};
const log = [
  [now - 3 * day, "anime:1", 2, "plus"],
  [now - 2 * 3600e3, "anime:1", 1, "plus"], [now - 3600e3, "anime:1", 1, "typed"], // today: merged into one row of 2
  [now - 5 * 3600e3, "manga:3", 4, "plus"],
  [now - day, "anime:1", 12, "complete"], // filled in by Completed: not "watched"
  [now - day, "anime:1", 0, "status:completed"],
  [now - day, "anime:2", 1, "plus"],
  [now - 2 * day, "anime:99", 5, "plus"], // no longer in your library
  [now - 2 * day, "anime:2", -1, "plus"], // an undo
];
const aired = [
  { item: anime(1, "Death Note"), episode: 7, airingAt: Math.floor((now - 4 * 3600e3) / 1000) }, // not watched yet
  { item: anime(1, "Death Note"), episode: 5, airingAt: Math.floor((now - 2 * day) / 1000) }, // watched (progress 6)
];
const args = { log, library, aired, labels: { 1: "Watching" }, progress: { 1: 6 }, now };
const ids = (sections) => sections.flatMap((s) => s.data.map((x) => x.id));

test("one row per title per day, newest first, in day sections", () => {
  const h = buildHistory(args);
  assert.deepEqual(h.map((s) => s.label), ["Today", "Yesterday", "Thu 15 Oct"]);
  const today = h[0].data;
  assert.deepEqual(today.map((x) => [x.item.title, x.type]), [["Death Note", "watched"], ["Death Note", "aired"], ["Berserk", "watched"]]);
  assert.equal(today[0].count, 2); // the two logs today are one row
  assert.deepEqual(historyText(today[0]), { line1: "Watched 2 episodes", line2: "" });
  assert.deepEqual(historyText(today[1]), { line1: "Episode 7", line2: "Watching" });
  assert.equal(historyText(today[2]).line1, "Read 4 chapters");
});

test("Completed shows, the fill-in log, undos and removed titles don't", () => {
  const all = buildHistory(args).flatMap((s) => s.data);
  assert.ok(all.some((x) => x.type === "status" && x.item.title === "Death Note"));
  assert.equal(all.filter((x) => x.type === "watched" && x.count === 12).length, 0);
  assert.equal(all.filter((x) => x.item.id === 99).length, 0);
  assert.equal(all.filter((x) => x.item.id === 2 && x.type === "watched").length, 1); // yesterday's +1 only
});

test("an aired episode you already watched isn't listed twice", () => {
  const all = buildHistory(args).flatMap((s) => s.data);
  assert.deepEqual(all.filter((x) => x.type === "aired").map((x) => x.episode), [7]);
});

test("the progress bar is how far through the show you are", () => {
  const all = buildHistory(args).flatMap((s) => s.data);
  assert.equal(all.find((x) => x.item.id === 1 && x.type === "watched").fraction, 0.5); // 6 of 12
  assert.equal(all.find((x) => x.item.id === 2).fraction, 0); // unknown length
  assert.equal(all.find((x) => x.type === "status").fraction, 1);
});

test("filters, search and removing", () => {
  assert.deepEqual(HISTORY_FILTERS.map((f) => f.key), ["all", "towatch", "watched", "anime", "manga", "novel"]);
  assert.deepEqual(buildHistory({ ...args, filter: "towatch" }).flatMap((s) => s.data).map((x) => x.type), ["aired"]);
  assert.ok(!buildHistory({ ...args, filter: "watched" }).flatMap((s) => s.data).some((x) => x.type === "aired"));
  assert.deepEqual(buildHistory({ ...args, filter: "manga" }).flatMap((s) => s.data).map((x) => x.item.title), ["Berserk"]);
  assert.deepEqual(buildHistory({ ...args, query: " berSERK " }).flatMap((s) => s.data).map((x) => x.item.title), ["Berserk"]);
  const first = ids(buildHistory(args))[0];
  assert.ok(!ids(buildHistory({ ...args, hidden: new Set([first]) })).includes(first));
});

test("removing today's row for a show hides what you'd logged, not the next episode you watch", () => {
  const library2 = { "anime:2": { item: anime(2, "One Piece", { episodes: null }), status: "watching", progress: 1182 } };
  const t1 = now - 3 * 3600e3; // watched 1181 this morning
  const t2 = now - 3600e3; // watched 1182 an hour ago, same day
  const first = buildHistory({ log: [[t1, "anime:2", 1, "plus"]], library: library2, now });
  const removed = new Set([first[0].data[0].id]); // you remove the 1181 row
  assert.equal(buildHistory({ log: [[t1, "anime:2", 1, "plus"]], library: library2, hidden: removed, now }).length, 0);
  const after = buildHistory({ log: [[t1, "anime:2", 1, "plus"], [t2, "anime:2", 1, "plus"]], library: library2, hidden: removed, now });
  assert.deepEqual(after[0].data.map((x) => [x.type, x.count]), [["watched", 1]]); // just 1182, not "2 episodes"
});

test("an aired episode you removed stays removed, and the next one still shows", () => {
  const op = anime(2, "One Piece", { episodes: null });
  const airedBoth = [{ item: op, episode: 1181, airingAt: Math.floor((now - 6 * day) / 1000) }, { item: op, episode: 1182, airingAt: Math.floor((now - 3600e3) / 1000) }];
  const lib = { "anime:2": { item: op, status: "watching", progress: 1180 } };
  const base = { log: [], library: lib, aired: airedBoth, labels: { 2: "Watching" }, progress: { 2: 1180 }, now };
  const hidden = new Set(["a:2:1181"]);
  assert.deepEqual(buildHistory({ ...base, hidden }).flatMap((s) => s.data).map((x) => x.episode), [1182]);
});

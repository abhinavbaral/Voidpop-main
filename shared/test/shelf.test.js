import { test } from "node:test";
import assert from "node:assert/strict";
import { memoryStorage } from "./helpers.js";
import { isShelf, playTime, progressLine, progressRatio, shelfCountdown } from "../features/shelfKinds.js";
import { fetchShelf, fetchShelfItem, searchShelf } from "../api/shelf.js";
import { weekSummary } from "../features/summaries.js";

memoryStorage();
const s = await import("../backend/store.js");

test("shelf helpers: time, progress line, ratio, countdown", () => {
  assert.equal(isShelf("game") && isShelf("comic"), true);
  assert.equal(isShelf("anime"), false);
  assert.equal(playTime(0), "0 m");
  assert.equal(playTime(45), "45 m");
  assert.equal(playTime(120), "2 h");
  assert.equal(playTime(1410), "23 h 30 m");
  const game = { segment: "game", hoursToBeat: 49 };
  assert.equal(progressLine(game, 1410), "23 h 30 m played of about 49 h");
  assert.equal(progressLine({ segment: "game" }, 60), "1 h played");
  assert.equal(progressLine({ segment: "comic", chapters: 48 }, 12), "Issue 12 of 48");
  assert.ok(Math.abs(progressRatio(game, 1470) - 0.5) < 1e-9);
  assert.equal(progressRatio({ segment: "comic" }, 3), null);
  const now = 1_000_000_000_000;
  assert.deepEqual(shelfCountdown({ segment: "game", releaseAt: now / 1000 + 100 }, now), { label: "Releases", airingAt: now / 1000 + 100 });
  assert.equal(shelfCountdown({ segment: "game", releaseAt: now / 1000 - 5 }, now), null);
  assert.equal(shelfCountdown({ segment: "comic", nextIssue: { issue: 13, airingAt: now / 1000 + 9 } }, now).label, "Issue 13");
});

test("sample catalogue answers popular, coming, search and single items", async () => {
  const g = (await fetchShelf("game")).items, c = (await fetchShelf("comic")).items;
  assert.ok(g.length >= 8 && c.length >= 6);
  assert.ok(g.every((x) => x.segment === "game" && x.demo) && c.every((x) => x.segment === "comic" && x.demo));
  const coming = (await fetchShelf("game", { sort: "coming" })).items;
  assert.ok(coming.length >= 3 && coming.every((x) => x.unreleased && x.releaseAt > Date.now() / 1000));
  assert.deepEqual(coming.map((x) => x.releaseAt), [...coming.map((x) => x.releaseAt)].sort((a, b) => a - b)); // soonest first
  assert.ok((await fetchShelf("comic", { sort: "coming" })).items.every((x) => x.nextIssue));
  assert.equal((await searchShelf("starfall")).length, 1);
  assert.equal((await searchShelf("")).length, 0);
  assert.equal((await fetchShelfItem("game", "demo-game-1")).title, "Starfall Drifter");
  assert.equal(await fetchShelfItem("game", "nope"), null);
});

test("a game on the shelf: status, time played, log, verdict, library kinds", async () => {
  const [game] = (await fetchShelf("game")).items;
  assert.deepEqual(s.statusesFor("game").map((x) => x.label), ["Playing", "Completed", "Replaying", "Backlog", "Considering", "On Hold", "Dropped"]);
  assert.equal(s.kindOf(game), "game");
  assert.ok(s.LIBRARY_KINDS.some((k) => k.key === "game") && s.LIBRARY_KINDS.some((k) => k.key === "comic"));
  assert.deepEqual(await s.setShelfProgress(game, 30), { ok: false, progress: 0 }); // not in the library yet

  await s.setCinemaStatus(game, "plan"); // Backlog
  assert.equal((await s.setShelfProgress(game, 90)).progress, 90);
  const entry = (await s.getLibraryAll())[`game:${game.id}`];
  assert.equal(entry.status, "watching"); // starting it moves Backlog to Playing
  assert.equal(entry.progress, 90);
  assert.equal(entry.item.developer, "Lanternworks"); // the game's own fields survive being saved
  assert.equal(entry.item.hoursToBeat, 49);

  await s.setShelfProgress(game, 150);
  await s.setShelfProgress(game, 120); // minus 30
  const log = (await s.getLog()).filter(([, key]) => key === `game:${game.id}`);
  assert.deepEqual(log.map((r) => r[2]).filter(Boolean), [90, 60, -30]);

  await s.saveCinemaReview(game, { verdict: "peak", moods: [], comment: "" });
  const after = await s.getCinemaEntry("game", game.id);
  assert.equal(after.status, "completed");
  assert.equal(after.progress, 120); // the verdict kept the time played
  assert.equal(after.review.verdict, "peak");
  await s.setCinemaStatus(game, "watching");
  assert.equal((await s.getCinemaEntry("game", game.id)).progress, 120); // changing the status keeps it too
});

test("a comic: reading statuses, issues, finishing fills the total", async () => {
  const [comic] = (await fetchShelf("comic")).items;
  assert.equal(s.statusesFor("comic")[0].label, "Reading");
  await s.setCinemaStatus(comic, "watching");
  await s.setShelfProgress(comic, 12);
  assert.equal((await s.getCinemaEntry("comic", comic.id)).progress, 12);
  await s.setCinemaStatus(comic, "completed");
  assert.equal((await s.getCinemaEntry("comic", comic.id)).progress, comic.chapters);
  await s.setCinemaStatus(comic, null);
  assert.equal(await s.getCinemaEntry("comic", comic.id), null);
});

test("this week's card counts games by started hour, so minutes don't swamp episodes", () => {
  const now = new Date(2026, 10, 13, 15).getTime();
  const at = (h) => new Date(2026, 10, 13, h).getTime();
  const w = weekSummary([[at(9), "game:x", 90, "plus"], [at(10), "anime:1", 2, "plus"], [at(11), "comic:2", 3, "plus"]], now);
  assert.equal(w.total, 2 + 2 + 3); // 90 min = 2 hours started
  assert.equal(w.titles, 3);
});

test("history shows games and comics: rows, wording, filters, bar", async () => {
  const { buildHistory, historyText, HISTORY_FILTERS } = await import("../features/history.js");
  const [game] = (await fetchShelf("game")).items, [comic] = (await fetchShelf("comic")).items;
  const lib = {
    [`game:${game.id}`]: { item: game, status: "watching", progress: 735 },
    [`comic:${comic.id}`]: { item: comic, status: "watching", progress: 12 },
  };
  const t = Date.now() - 1000;
  const log = [[t, `game:${game.id}`, 90, "plus"], [t, `comic:${comic.id}`, 2, "plus"]];
  const rows = buildHistory({ log, library: lib }).flatMap((x) => x.data);
  assert.equal(rows.length, 2);
  const g = rows.find((r) => r.item.segment === "game"), c = rows.find((r) => r.item.segment === "comic");
  assert.equal(historyText(g).line1, "Played 1 h 30 m");
  assert.equal(historyText(c).line1, "Read 2 issues");
  assert.ok(Math.abs(g.fraction - 735 / (49 * 60)) < 1e-9);
  assert.equal(buildHistory({ log, library: lib, filter: "game" }).flatMap((x) => x.data).length, 1);
  assert.ok(HISTORY_FILTERS.some((f) => f.key === "game") && HISTORY_FILTERS.some((f) => f.key === "comic"));
});

test("a comic's total is its issue count, and finished wording fits each kind", async () => {
  const [comic] = (await fetchShelf("comic")).items, [game] = (await fetchShelf("game")).items;
  assert.equal(s.totalFor(comic), comic.chapters);
  assert.equal(s.doneLabel(comic), `✓ All ${comic.chapters} read`);
  assert.equal(s.doneLabel(game), "✓ Completed");
});

test("entry line: where you are, for every kind", async () => {
  const { entryLine } = await import("../features/entryLine.js");
  const now = 1_000_000_000_000;
  const [game] = (await fetchShelf("game")).items, [comic] = (await fetchShelf("comic")).items;
  assert.equal(entryLine({ item: game, status: "watching", progress: 90 }, now).line, "1 h 30 m played");
  assert.equal(entryLine({ item: game, status: "plan", progress: 0 }, now).line, "Not started");
  const c = entryLine({ item: comic, status: "watching", progress: 12 }, now);
  assert.equal(c.line, `Issue 12/${comic.chapters}`);
  assert.ok(Math.abs(c.ratio - 12 / comic.chapters) < 1e-9);
  const anime = { segment: "anime", id: 1, title: "A", episodes: 12, nextEpisode: { episode: 8, airingAt: now / 1000 + 90000 } };
  const a = entryLine({ item: anime, status: "watching", progress: 7 }, now);
  assert.match(a.line, /^Ep 7\/12 · in 1d/);
  assert.equal(entryLine({ item: { segment: "manga", id: 2, title: "M", chapters: 100 }, status: "completed", progress: 100 }, now).ratio, 1);
  assert.equal(entryLine({ item: { segment: "movie", id: 3, title: "F", dateLabel: "2025" }, status: "plan" }, now).line, "2025");
});

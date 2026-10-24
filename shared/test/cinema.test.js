import { test } from "node:test";
import assert from "node:assert/strict";
import { memoryStorage } from "./helpers.js";

memoryStorage();
const s = await import("../backend/store.js");
const tmdb = await import("../api/tmdb.js");
const { communitySplit, countVotes, MIN_VERDICTS } = await import("../features/verdictMeter.js");
const { buildCollections, moreLikeThis, featuredPick } = await import("../features/cinema.js");
const { DEMO_CINEMA } = await import("../demo/cinema.js");

const film = (id, extra = {}) => ({ id, segment: "movie", title: `Film ${id}`, genres: ["Drama"], genre: "Drama", overview: "x".repeat(900), ...extra });

/* ---------- the shelf ---------- */

test("shelf: watchlist → watched with a verdict; changing it keeps the earlier one", async () => {
  await s.setCinemaStatus(film(1), "plan");
  assert.equal((await s.getCinemaEntry("movie", 1)).status, "plan");

  await s.saveCinemaReview(film(1), { verdict: "peak", moods: ["Made me feel alive."], comment: "wow" });
  let e = await s.getCinemaEntry("movie", 1);
  assert.equal(e.status, "completed"); // Watched
  assert.equal(e.review.verdict, "peak");
  assert.equal(e.review.history, undefined);

  await s.saveCinemaReview(film(1), { verdict: "divein", moods: [], comment: "" });
  e = await s.getCinemaEntry("movie", 1);
  assert.deepEqual(e.review.history.map((h) => h.verdict), ["peak"]);
});

test("shelf: moving back to the watchlist keeps the verdict; removing deletes it", async () => {
  await s.setCinemaStatus(film(1), "plan");
  assert.equal((await s.getCinemaEntry("movie", 1)).review.verdict, "divein");
  await s.setCinemaStatus(film(1), null);
  assert.equal(await s.getCinemaEntry("movie", 1), null);
  await assert.rejects(() => s.setCinemaStatus(film(1), "watching"), /Unknown status/);
});

test("shelf: snapshots stay small, and movies never enter the anime/manga library or stats", async () => {
  const before = (await s.getStats()).totalCompleted;
  await s.setCinemaStatus(film(2, { cast: ["a"], sampleVotes: { peak: 1 } }), "completed");
  const e = await s.getCinemaEntry("movie", 2);
  assert.equal(e.item.overview.length, 400);
  assert.equal(e.item.cast, undefined);
  assert.deepEqual(Object.keys(await s.getLibrary()).filter((k) => k.startsWith("movie:")), []);
  assert.equal((await s.getStats()).totalCompleted, before);
});

test("shelf: backup round-trips it, old backups without it still restore, CSV lists it", async () => {
  await s.setCinemaStatus(film(3, { title: "Past, Lives" }), "plan");
  const backup = await s.exportData();
  assert.ok(JSON.parse(backup).cinema["movie:3"]);
  assert.match(await s.exportLibraryCsv(), /Movie,"Past, Lives",Plan to Watch/);

  await s.clearData();
  assert.deepEqual(await s.getCinemaShelf(), []);
  assert.equal(await s.importData(backup), null);
  assert.equal((await s.getCinemaShelf()).length, 2);

  const old = JSON.parse(backup);
  delete old.cinema;
  assert.equal(await s.importData(JSON.stringify(old)), null);
  assert.deepEqual(await s.getCinemaShelf(), []);
});

/* ---------- the verdict meter ---------- */

test("meter: hidden under 20 verdicts, then percentages that add to 100", () => {
  const few = communitySplit({ peak: 10, voidit: 9 });
  assert.equal(few.ready, false);
  assert.equal(few.remaining, 1);
  assert.deepEqual(few.rows, []);

  const ok = communitySplit({ peak: 1, divein: 1, onetime: 1, voidit: 17 });
  assert.equal(ok.ready, true);
  assert.equal(ok.total, 20);
  assert.equal(ok.rows.reduce((n, r) => n + r.pct, 0), 100);
  assert.equal(communitySplit({ peak: 1, divein: 1, onetime: 1 }, 3).rows.reduce((n, r) => n + r.pct, 0), 100); // 33/33/33 → 34/33/33
  assert.equal(MIN_VERDICTS, 20);
});

test("meter: only people who finished or dropped count", () => {
  const counts = countVotes([
    { verdict: "peak", status: "completed" }, { verdict: "voidit", status: "dropped" },
    { verdict: "peak", status: "watching" }, { verdict: "peak", status: "plan" },
    { verdict: "nonsense", status: "completed" },
  ]);
  assert.deepEqual(counts, { peak: 1, voidit: 1 });
});

test("meter: the sample catalog shows one open and one locked meter", () => {
  const states = DEMO_CINEMA.map((t) => communitySplit(t.sampleVotes).ready);
  assert.ok(states.includes(true) && states.includes(false));
  assert.equal(communitySplit(DEMO_CINEMA.find((t) => t.id === "demo-9").sampleVotes).ready, false);
});

/* ---------- TMDB client ---------- */

test("tmdb: without a key everything comes from the sample catalog", async () => {
  assert.equal(tmdb.hasTmdb(), false);
  const all = await tmdb.fetchCinema("movie");
  assert.equal(all.demo, true);
  assert.ok(all.items.every((t) => t.segment === "movie"));
  assert.deepEqual((await tmdb.fetchCinema("tv", { genre: "Mystery" })).items.map((t) => t.title), ["Severance"]);
  assert.deepEqual((await tmdb.fetchCinema("movie", { search: "dune" })).items.map((t) => t.id), ["demo-1"]);
  assert.equal((await tmdb.fetchCinemaDetail("tv", "demo-2")).item.title, "The Bear");
  await assert.rejects(() => tmdb.fetchCinemaDetail("movie", "demo-2"), /not found/);
  await assert.rejects(() => tmdb.fetchCinema("anime"), /Unknown segment/);
});

test("tmdb: with a key, answers become VoidPop items", async () => {
  const calls = [];
  globalThis.fetch = async (url) => {
    calls.push(String(url));
    const path = new URL(url).pathname;
    const json = path.startsWith("/3/discover/")
      ? { page: 1, total_pages: 3, results: [
        { id: 7, title: "Dune", original_title: "Dune", release_date: "2024-03-01", genre_ids: [878, 12], poster_path: "/p.jpg", backdrop_path: "/b.jpg", vote_average: 8.26, vote_count: 900, overview: "Sand." },
        { id: 8, title: "No poster", release_date: "2024-03-01", genre_ids: [18] }] }
      : { id: 7, title: "Dune", release_date: "2024-03-01", runtime: 167, genres: [{ id: 878, name: "Science Fiction" }], poster_path: "/p.jpg", tagline: "Long live the fighters",
        credits: { crew: [{ job: "Director", name: "Denis Villeneuve" }, { job: "Editor", name: "X" }], cast: [{ name: "Zendaya" }] },
        videos: { results: [{ site: "YouTube", type: "Trailer", key: "abc" }] },
        "watch/providers": { results: { US: { flatrate: [{ provider_name: "Max" }] } } } };
    return { ok: true, status: 200, json: async () => json };
  };
  tmdb.configureTmdb({ apiKey: "k" });
  assert.equal(tmdb.hasTmdb(), true);

  const page = await tmdb.fetchCinema("movie", { sort: "rated", genre: "Sci-Fi" });
  assert.equal(page.demo, false);
  assert.equal(page.hasMore, true);
  assert.equal(page.items.length, 1); // the one without a poster is dropped
  const d = page.items[0];
  assert.deepEqual([d.id, d.segment, d.title, d.genres, d.score, d.dateLabel], [7, "movie", "Dune", ["Sci-Fi", "Adventure"], 8.3, "1 Mar 2024"]);
  assert.equal(d.image, "https://image.tmdb.org/t/p/w500/p.jpg");
  assert.match(calls[0], /with_genres=878/);
  assert.match(calls[0], /vote_count\.gte=300/);
  assert.match(calls[0], /sort_by=vote_average\.desc/);

  const detail = await tmdb.fetchCinemaDetail("movie", 7);
  assert.equal(detail.item.creator, "Denis Villeneuve");
  assert.equal(detail.item.runtime, "2h 47m");
  assert.deepEqual([detail.trailer, detail.services, detail.cast], ["abc", ["Max"], ["Zendaya"]]);

  tmdb.configureTmdb({ apiKey: "" }); // blank values never overwrite a setting
  assert.equal(tmdb.hasTmdb(), true);
});

/* ---------- collections, hero, more like this ---------- */

test("collections: rules fill from the pool, no title twice, thin ones are left out", () => {
  const cols = buildCollections(DEMO_CINEMA);
  assert.equal(cols.length, 3);
  const keys = cols.flatMap((c) => c.items.map((t) => t.id));
  assert.equal(new Set(keys).size, keys.length);
  assert.ok(cols.find((c) => c.key === "one-more").items.every((t) => t.segment === "tv"));
  assert.deepEqual(buildCollections(DEMO_CINEMA.filter((t) => t.segment === "movie")).map((c) => c.key), ["editors-shelf", "weekend"]);
  assert.deepEqual(buildCollections([]), []);
});

test("more like this: shared genres, never itself, nothing unrelated", () => {
  const dune = DEMO_CINEMA[0];
  const like = moreLikeThis(dune, DEMO_CINEMA);
  assert.ok(like.length > 0 && like.length <= 6);
  assert.ok(!like.includes(dune));
  assert.ok(like.every((t) => t.genres.some((g) => dune.genres.includes(g))));
  assert.deepEqual(moreLikeThis({ ...dune, genres: ["Western"], creator: null }, DEMO_CINEMA), []);
  assert.ok(!moreLikeThis(dune, DEMO_CINEMA, { exclude: ["movie:demo-10"] }).some((t) => t.id === "demo-10"));
  assert.equal(featuredPick(DEMO_CINEMA).id, "demo-1");
  assert.equal(featuredPick([]), null);
});

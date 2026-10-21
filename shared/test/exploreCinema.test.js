// What Explore loads beyond anime: movie and TV pools, upcoming books, award winners, new seasons, Most loved.
// TMDB and AniList are both answered by a fake fetch; nothing touches the network.
import { test } from "node:test";
import assert from "node:assert/strict";
import { memoryStorage, media } from "./helpers.js";

let mem = memoryStorage();
const tmdb = await import("../api/tmdb.js");
const anilist = await import("../api/anilist.js");
const store = await import("../backend/store.js");
const x = await import("../features/exploreCinema.js");

const ids = (list) => list.map((it) => it.id);
const film = (id, extra = {}) => ({ id, title: `Film ${id}`, release_date: "2024-05-01", poster_path: `/${id}.jpg`, genre_ids: [18], ...extra });
const show = (id, extra = {}) => ({ id, name: `Show ${id}`, first_air_date: "2022-01-01", poster_path: `/${id}.jpg`, genre_ids: [18], ...extra });
const json = (data) => ({ ok: true, status: 200, headers: { get: () => null }, json: async () => data });
const settle = () => new Promise((r) => setTimeout(r, 30)); // AniList saves each answer a moment after replying
const daysAgo = (n) => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);

// one fake fetch for both services: tmdb(path, params) → json, anilist(query, variables) → data
function fakeFetch({ tmdb: onTmdb = () => ({ results: [], page: 1, total_pages: 1 }), anilist: onAni = () => ({ Page: { pageInfo: { hasNextPage: false }, media: [] } }) } = {}) {
  const calls = { tmdb: [], anilist: [] };
  globalThis.fetch = async (url, opts) => {
    if (String(url).includes("themoviedb")) {
      const u = new URL(url);
      const params = Object.fromEntries(u.searchParams);
      calls.tmdb.push({ path: u.pathname.replace("/3", ""), params });
      return json(await onTmdb(u.pathname.replace("/3", ""), params));
    }
    const { query, variables } = JSON.parse(opts.body);
    calls.anilist.push({ query, variables });
    return json({ data: await onAni(query, variables || {}) });
  };
  return calls;
}
const withKey = (language) => tmdb.configureTmdb({ apiKey: "k", language }); // another language = another URL, so earlier answers aren't reused

/* ---------- no key ---------- */

// Runs first on purpose: configureTmdb ignores blank values, so a key can't be taken back once a later test sets one.
test("awards and new seasons: without a TMDB key nothing is fetched and the lists are empty (the tiles fall back)", async () => {
  mem = memoryStorage();
  assert.equal(tmdb.hasTmdb(), false);
  const calls = fakeFetch();
  assert.deepEqual(await x.loadAwards(), { oscars: [], emmys: [] });
  assert.deepEqual(await x.loadNewSeasonsTv(), []);
  assert.equal(calls.tmdb.length, 0);
});

/* ---------- movies and TV pools ---------- */

test("pools: released and upcoming are split, trending is split by kind, no title appears twice", async () => {
  withKey("en-A");
  fakeFetch({
    tmdb: (path, p) => {
      const tv = path.includes("/tv");
      if (path.startsWith("/trending/")) return { results: [{ ...film(60), media_type: "movie" }, { ...show(61), media_type: "tv" }, { id: 5, media_type: "person" }] };
      if (p.sort_by === "vote_average.desc") return { page: 1, total_pages: 1, results: [tv ? show(70) : film(50)] };
      const pageOf = { 1: [tv ? show(1) : film(1), tv ? show(2) : film(2)], 2: [tv ? show(2) : film(2), tv ? show(3, { first_air_date: "2099-01-01" }) : film(3, { release_date: "2099-01-01" })] };
      return { page: Number(p.page), total_pages: 3, results: pageOf[p.page] || [] };
    },
  });
  const pools = await x.loadCinemaPools();
  assert.deepEqual([ids(pools.popMv), ids(pools.comingMv)], [[1, 2], [3]]); // Film 2 came on two pages: kept once
  assert.deepEqual([ids(pools.popTv), ids(pools.comingTv)], [[1, 2], [3]]);
  assert.deepEqual([ids(pools.trMv), ids(pools.trTv)], [[60], [61]]);
  assert.deepEqual([ids(pools.topMv), ids(pools.topTv)], [[50], [70]]);
  assert.ok(pools.popMv.every((it) => it.segment === "movie") && pools.popTv.every((it) => it.segment === "tv"));
});

test("pools: when TMDB can't be reached every pool is an empty list, never missing (a missing pool means 'still loading')", async () => {
  withKey("en-B");
  globalThis.fetch = async () => { throw new Error("offline"); };
  const pools = await x.loadCinemaPools();
  for (const k of ["popMv", "popTv", "trMv", "trTv", "topMv", "topTv", "comingMv", "comingTv"]) assert.deepEqual(pools[k], [], k);
});

/* ---------- upcoming books and Most loved ---------- */

test("upcoming books: manga and novels that aren't out yet", async () => {
  const calls = fakeFetch({ anilist: (q, v) => ({ Page: { pageInfo: { hasNextPage: false }, media: [media(/format_in/.test(q) ? 20 : 10, { status: "NOT_YET_RELEASED" })] } }) });
  mem = memoryStorage();
  const books = await x.loadComingBooks();
  assert.deepEqual([ids(books.comingM), ids(books.comingN)], [[10], [20]]);
  assert.ok(calls.anilist.every((c) => /NOT_YET_RELEASED/.test(c.query)));
});

test("most loved: every kind in turns, from 'mixed'; rejects only when nothing at all loaded", async () => {
  mem = memoryStorage();
  fakeFetch({ anilist: (q) => ({ Page: { pageInfo: { hasNextPage: false }, media: [media(/format_in/.test(q) ? 300 : 200)] } }) });
  const a = (id) => ({ id, segment: "anime", title: `A${id}` });
  const r = await x.loadMostLoved([a(1), a(2)], [{ id: 9, segment: "movie", title: "M9" }], [{ id: 8, segment: "tv", title: "T8" }]);
  assert.equal(r.from, "mixed");
  assert.deepEqual(r.items.map((it) => `${it.segment}:${it.id}`), ["anime:1", "manga:200", "manga:300", "movie:9", "tv:8", "anime:2"]); // (AniList gives novels the segment "manga")

  await settle(); // let the first scenario's saves finish before the storage is swapped
  mem = memoryStorage();
  await anilist.cacheClear();
  fakeFetch(); // AniList answers with nothing
  await assert.rejects(() => x.loadMostLoved([], [], []), /Nothing to rank/);
  assert.equal((await x.loadMostLoved([a(1)], [], [])).items.length, 1);
});

/* ---------- Oscars and Emmys ---------- */

// every search finds its title exactly once; Moonlight and Shōgun also bring an older namesake first
function fakeAwards({ failEvery = 0 } = {}) {
  const seen = new Map();
  const idFor = (q) => (seen.has(q) ? seen.get(q) : (seen.set(q, 100 + seen.size), seen.get(q)));
  return fakeFetch({
    tmdb: (path, p) => {
      const q = p.query;
      if (failEvery && idFor(q) % failEvery === 0) throw new Error("TMDB error 500");
      if (path === "/search/movie") {
        const now = { id: idFor(q), title: q, release_date: "2020-01-01", poster_path: "/p.jpg" };
        return { page: 1, total_pages: 1, results: q === "Moonlight" ? [{ ...now, id: 1, release_date: "1998-05-01" }, { ...now, id: 2, release_date: "2016-10-21" }] : [now] };
      }
      const now = { id: idFor(q), name: q === "Shōgun" ? "Shogun" : q, first_air_date: "2020-01-01", poster_path: "/p.jpg" };
      return { page: 1, total_pages: 1, results: q === "Shōgun" ? [{ ...now, id: 3, first_air_date: "1980-09-15" }, { ...now, id: 4, first_air_date: "2024-02-27" }] : [now] };
    },
  });
}

test("awards: winners are looked up by exact title and year, accents don't matter, and the answer is kept for a week", async () => {
  mem = memoryStorage();
  withKey("en-C");
  const calls = fakeAwards();
  const a = await x.loadAwards();
  assert.equal(a.oscars.length, 10);
  assert.equal(a.emmys.length, 15);
  assert.equal(a.oscars[0].title, "One Battle After Another"); // newest first
  assert.equal(a.oscars.at(-1).id, 2); // the 2016 Moonlight, not the 1998 one
  assert.equal(a.emmys.find((it) => it.title === "Shogun").id, 4); // "Shōgun" matched "Shogun", the 2024 series
  assert.ok(a.oscars.every((it) => it.segment === "movie") && a.emmys.every((it) => it.segment === "tv"));

  const before = calls.tmdb.length;
  const again = await x.loadAwards();
  assert.equal(calls.tmdb.length, before); // served from the device
  assert.deepEqual(ids(again.oscars), ids(a.oscars));
});

test("awards: a lookup that mostly failed isn't kept, so the next launch tries again; what did load still shows", async () => {
  mem = memoryStorage();
  withKey("en-D");
  fakeAwards({ failEvery: 2 }); // every second title fails
  const a = await x.loadAwards();
  assert.ok(a.oscars.length > 0 && a.oscars.length < 10);
  assert.ok(a.emmys.length > 0 && a.emmys.length < 15);
  assert.equal(Object.keys(mem).filter((k) => k.includes("awards")).length, 0);
});

/* ---------- new seasons of series you watched ---------- */

test("new seasons: a series with more seasons than when you saved it, or a finished one still airing; not ended ones, ones you're mid-way through, or movies", async () => {
  mem = memoryStorage();
  withKey("en-E");
  const saved = (id, status, extra = {}) => store.setCinemaStatus({ id, segment: "tv", title: `Series ${id}`, genres: [], ...extra }, status);
  await saved(1, "completed", { seasons: 2 }); // now has 3: new season
  await saved(2, "completed"); // season count unknown, but still airing recently
  await saved(3, "completed", { seasons: 4 }); // ended long ago
  await saved(4, "watching", { seasons: 1 }); // airing, but you're still on it: nothing "new"
  await saved(5, "plan", { seasons: 1 }); // not watched yet: not checked at all
  await store.setCinemaStatus({ id: 6, segment: "movie", title: "A film", genres: [] }, "completed");
  const detail = {
    1: show(1, { number_of_seasons: 3, status: "Returning Series", last_air_date: daysAgo(90) }),
    2: show(2, { number_of_seasons: 2, status: "Returning Series", last_air_date: daysAgo(20) }),
    3: show(3, { number_of_seasons: 4, status: "Ended", last_air_date: daysAgo(900) }),
    4: show(4, { number_of_seasons: 1, status: "Returning Series", last_air_date: daysAgo(5) }),
    5: show(5, { number_of_seasons: 9, status: "Returning Series", last_air_date: daysAgo(5) }),
  };
  const calls = fakeFetch({ tmdb: (path) => detail[Number(path.split("/")[2])] });
  const out = await x.loadNewSeasonsTv();
  assert.deepEqual(ids(out), [2, 1]); // newest episode first
  assert.ok(out.every((it) => it.segment === "tv"));
  assert.deepEqual(calls.tmdb.map((c) => Number(c.path.split("/")[2])).sort(), [1, 2, 3, 4]); // plan-to-watch and the film were never requested
});

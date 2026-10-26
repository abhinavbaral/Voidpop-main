// Explore's fixed tiles: titles never change, only the shows (and only on Reroll).
import { test } from "node:test";
import assert from "node:assert/strict";
import { TILES, GRID_KEYS, ROW_KEYS, EXTRA, TALK_KINDS, TALK_DEFAULT, viewTile, seededShuffle, dedupe, poolFor, chosenSource, nextSource, PICK_COUNT } from "../features/exploreTiles.js";

const show = (id, extra = {}) => ({ id, segment: "anime", title: `Show ${id}`, ...extra });
const WATCHABLE = ["anime", "movie", "tv"];
const many = (from, n) => Array.from({ length: n }, (_, i) => show(from + i));
const ids = (items) => items.map((x) => x.id);
const base = () => ({
  pools: { trA: many(1, 40), popA: many(100, 60), popM: many(200, 30).map((x) => ({ ...x, segment: "manga" })), popN: [], coming: [], isekai: many(300, 30), shonen: many(400, 30) },
  known: new Set(), aoty: [show(900), show(901)], mostLoved: many(500, 40), trend: many(600, 40), country: "KR",
  verdicts: { peak: { source: show(7, { title: "Death Note" }), items: many(700, 25) }, divein: { source: null, items: [] }, onetime: { source: null, items: [] } },
  newSeasons: [], jump: { anime: [show(800), show(801)], manga: [] }, seeds: {}, saved: {}, extra: {}, busy: {},
});

test("20 tiles with unique keys, split into the grid and the poster rows; the fixed lists can't be rerolled", () => {
  assert.equal(TILES.length, 20);
  assert.equal(new Set(TILES.map((t) => t.key)).size, 20);
  assert.deepEqual(ROW_KEYS, ["talk", "best", "watch", "peak", "divein", "onetime", "loved"]);
  assert.deepEqual([...GRID_KEYS, ...ROW_KEYS].sort(), TILES.map((t) => t.key).sort()); // every tile is shown exactly once
  assert.ok(!TILES.some((t) => ["isekai", "shonen"].includes(t.key))); // Isekai Heaven and Shonen Feast are gone: those are genres in Browse now
  assert.deepEqual(TILES.filter((t) => !t.reroll).map((t) => t.key), ["best", "loved", "trending", "coming", "aoty", "oscars", "emmys", "jump", "seasons"]);
  Object.keys(EXTRA).forEach((k) => assert.ok(TILES.find((t) => t.key === k), k)); // every Reroll source belongs to a tile
});

test("a shuffle keeps the same shows, is the same for the same seed, and differs for another", () => {
  const list = many(1, 30);
  assert.deepEqual(ids(seededShuffle(list, 5)), ids(seededShuffle(list, 5)));
  assert.notDeepEqual(ids(seededShuffle(list, 5)), ids(seededShuffle(list, 6)));
  assert.deepEqual(ids(seededShuffle(list, 5)).sort((a, b) => a - b), ids(list));
  assert.equal(dedupe([show(1), show(1), show(2)]).length, 2);
});

test("while loading a tile keeps its title and has no shows yet", () => {
  const v = viewTile("dmAnime", { ...base(), pools: null });
  assert.deepEqual([v.title, v.loading, v.items], ["Don't Miss This — Anime", true, null]);
  assert.equal(viewTile("loved", { ...base(), mostLoved: null }).loading, true);
});

test("verdict tiles: titled after the title they are like, and still there with none", () => {
  const st = base();
  assert.equal(viewTile("peak", st).title, "Peak like Death Note");
  const none = viewTile("divein", st);
  assert.equal(none.title, "Dive in like …");
  assert.ok(none.items.length >= 6); // never empty: popular picks until you have a verdict
  assert.match(none.subtitle, /until you give a title the Dive In verdict/);
});

test("the picks stay the same until you reroll: a new seed changes them, and rankings ignore it", () => {
  const st = base();
  assert.deepEqual(ids(viewTile("dmAnime", st).items), ids(viewTile("dmAnime", st).items));
  assert.equal(viewTile("dmAnime", st).items.length, PICK_COUNT);
  const rerolled = { ...st, seeds: { dmAnime: 4242 } };
  assert.notDeepEqual(ids(viewTile("dmAnime", rerolled).items), ids(viewTile("dmAnime", st).items));
  // Most loved and Trending are rankings: same order whatever the seed
  const ranked = { ...st, seeds: { loved: 99, trending: 99 } };
  assert.deepEqual(ids(viewTile("loved", ranked).items), ids(st.mostLoved.slice(0, 30)));
  assert.deepEqual(ids(viewTile("trending", ranked).items), ids(st.trend.slice(0, 30)));
  assert.equal(viewTile("trending", st).title, "Trending in Korea");
});

test("what's in your library or Excited never shows, except in Jump back in and Anime of the Year", () => {
  const st = { ...base(), known: new Set(["anime:100", "anime:101", "anime:800", "anime:900"]) };
  assert.ok(!ids(viewTile("dmAnime", st).items).includes(100));
  assert.deepEqual(ids(viewTile("jump", st).items), [800, 801]);
  assert.deepEqual(ids(viewTile("aoty", st).items), [900, 901]);
});

test("Coming soon: soonest first, without sequels of shows you watched", () => {
  const coming = [show(1, { date: "2027-02-01" }), show(2, { date: "2026-11-01" }), show(3), show(4, { date: "2026-12-01" }), ...many(60, 4).map((x, i) => ({ ...x, date: `2027-03-0${i + 1}` }))];
  const st = { ...base(), pools: { ...base().pools, coming, comingTitle: "Coming soon", comingChip: { label: "Fall 2026 & Winter 2027" } }, newSeasons: [show(4)] };
  const v = viewTile("coming", st);
  assert.deepEqual(ids(v.items), [2, 1, 60, 61, 62, 63, 3]); // soonest first, undated last, and not show 4 (a sequel of one you watched)
  assert.equal(v.subtitle, "Fall 2026 & Winter 2027");
});

test("VoidPop Angles never repeats Don't Miss This — Anime", () => {
  const st = base();
  const dm = new Set(ids(viewTile("dmAnime", st).items));
  assert.ok(ids(viewTile("angles", st).items).every((id) => !dm.has(id)));
});

test("picks kept from the last Reroll are used while most of them are still unmarked", () => {
  const kept = many(450, 18);
  const st = { ...base(), saved: { dmAnime: kept } };
  assert.deepEqual(ids(viewTile("dmAnime", st).items), ids(kept));
  const mostlyAdded = { ...st, known: new Set(kept.slice(0, 15).map((x) => `anime:${x.id}`)) };
  assert.notDeepEqual(ids(viewTile("dmAnime", mostlyAdded).items), ids(kept.slice(15))); // too few left: back to the pool
  assert.ok(viewTile("dmAnime", mostlyAdded).items.length >= 6);
});

test("a tile is never empty: it tops up, falls back, or shows what it showed last time", () => {
  const st = base();
  // pool nearly used up by your library: topped up from popular shows, and says so
  const allKnown = new Set(st.pools.popA.slice(0, 57).map((x) => `anime:${x.id}`)); // only 3 of the pool left
  const thin = viewTile("dmAnime", { ...st, known: allKnown });
  assert.ok(thin.items.length >= 6); // topped up from related shows
  assert.ok(thin.items.every((x) => !allKnown.has(`anime:${x.id}`)));
  // Jump back in with nothing left behind: what's still on your list, then trending
  const empty = { ...st, jump: { anime: [], manga: [] } };
  assert.match(viewTile("jump", empty).subtitle, /Nothing started yet/);
  assert.deepEqual(ids(viewTile("jump", { ...empty, jumpFallback: [show(810)] }).items), [810]);
  // New seasons with none: Coming soon instead; Anime of the Year not loaded: Most loved instead
  const nothing = viewTile("seasons", { ...st, pools: { ...st.pools, coming: many(70, 8) }, newSeasons: [] });
  assert.ok(nothing.items.length >= 6);
  assert.match(viewTile("aoty", { ...st, aoty: [] }).subtitle, /Most loved instead/);
  // offline on a later launch: the pools are empty but each tile shows what it showed last time
  const offline = { ...st, pools: { trA: [], popA: [], popM: [], popN: [], coming: [] }, mostLoved: [], trend: [], aoty: [], verdicts: { peak: { source: null, items: [] }, divein: { source: null, items: [] }, onetime: { source: null, items: [] } }, last: { dmAnime: { title: "Don't Miss This — Anime", subtitle: null, items: many(300, 18) } } };
  assert.deepEqual(ids(viewTile("dmAnime", offline).items), ids(many(300, 18)));
  // and while a tile is still loading, last time's title and shows are there at once
  const loading = viewTile("peak", { ...st, verdicts: null, last: { peak: { title: "Peak like Death Note", subtitle: null, items: many(700, 10) } } });
  assert.deepEqual([loading.title, loading.loading, loading.items.length], ["Peak like Death Note", false, 10]);
  // truly nothing and nothing remembered (first launch, offline): say so
  assert.match(viewTile("dmAnime", { ...offline, last: {} }).empty, /Can't load shows/);
});

test("fixed lists ignore a seed, and poolFor leaves out what you've marked", () => {
  const st = { ...base(), seeds: { coming: 5, aoty: 5, jump: 5, seasons: 5 } };
  assert.deepEqual(ids(viewTile("aoty", st).items), [900, 901]);
  assert.deepEqual(ids(viewTile("jump", st).items), [800, 801]);
  assert.equal(poolFor("dmAnime", { ...st, known: new Set(["anime:100"]) }).length, 59);
});

test("Peak like / Dive in like / One time like move to another of your titles, and the title follows", () => {
  const mine = [show(7, { title: "Death Note" }), show(21, { title: "One Piece" }), show(30, { title: "Naruto" })];
  assert.equal(chosenSource(mine, undefined).title, "Death Note"); // starts on your most recent
  assert.equal(chosenSource(mine, "anime:21").title, "One Piece"); // keeps the one you rerolled to
  assert.equal(chosenSource(mine, "anime:999").title, "Death Note"); // gone (verdict changed): back to the latest
  assert.equal(chosenSource([], "anime:7"), null);
  // reroll never lands on the same title while you have another
  for (const r of [0, 0.3, 0.6, 0.99]) assert.notEqual(nextSource(mine, mine[0], () => r).id, 7);
  assert.equal(nextSource([mine[0]], mine[0]).id, 7); // only one: it stays, and its picks reshuffle
  assert.equal(nextSource([], null), null);
  // and the tile's title is that title's name
  const st = base();
  const onePiece = { ...st, verdicts: { ...st.verdicts, peak: { source: mine[1], items: many(740, 20) } } };
  assert.equal(viewTile("peak", st).title, "Peak like Death Note");
  assert.equal(viewTile("peak", onePiece).title, "Peak like One Piece");
});


/* ---------- Explore with movies and TV ---------- */

const film = (id, extra = {}) => ({ id, segment: "movie", title: `Film ${id}`, genres: ["Drama"], ...extra });
const serial = (id, extra = {}) => ({ id, segment: "tv", title: `Series ${id}`, genres: ["Drama"], ...extra });
const withCinema = () => {
  const st = base();
  st.pools = {
    ...st.pools, popN: many(250, 20).map((x) => ({ ...x, segment: "manga" })),
    trMv: Array.from({ length: 20 }, (_, i) => film(1000 + i)), trTv: Array.from({ length: 20 }, (_, i) => serial(2000 + i)),
    popMv: Array.from({ length: 30 }, (_, i) => film(3000 + i)), popTv: Array.from({ length: 30 }, (_, i) => serial(4000 + i)),
    topMv: Array.from({ length: 10 }, (_, i) => film(5000 + i)), topTv: Array.from({ length: 10 }, (_, i) => serial(6000 + i)),
    comingMv: [film(7001, { date: "2027-02-01" }), film(7002, { date: "2027-01-01" })], comingTv: [serial(7101, { date: "2026-12-01" })],
    comingM: [{ id: 7201, segment: "manga", title: "Upcoming manga", date: "2026-11-15" }], comingN: [{ id: 7401, segment: "manga", title: "Upcoming novel", date: "2026-11-20" }], coming: [show(7301, { date: "2026-12-20" })],
  };
  st.oscars = [film(8001), film(8002)]; st.emmys = [serial(8101)];
  return st;
};
const kinds = (items) => [...new Set(items.map((x) => x.segment))].sort();

test("Coming soon is for everything, soonest first", () => {
  const v = viewTile("coming", withCinema());
  assert.deepEqual(ids(v.items), [7201, 7401, 7101, 7301, 7002, 7001]);
  assert.deepEqual(kinds(v.items), ["anime", "manga", "movie", "tv"]);
});

test("Oscars and Emmys show their winners; if they can't load, the top rated of that kind", () => {
  const st = withCinema();
  assert.deepEqual([viewTile("oscars", st).items.map((x) => x.id), viewTile("emmys", st).items.map((x) => x.id)], [[8001, 8002], [8101]]);
  assert.equal(viewTile("oscars", st).subtitle, "Best Picture winners");
  st.oscars = []; st.emmys = [];
  const o = viewTile("oscars", st), e = viewTile("emmys", st);
  assert.deepEqual([kinds(o.items), kinds(e.items)], [["movie"], ["tv"]]);
  assert.match(o.subtitle, /Top rated/);
  assert.equal(viewTile("oscars", { ...st, oscars: null }).loading, true);
});

test("VoidPop Angles mixes all five kinds; Don't Miss This has movies and TV", () => {
  const st = withCinema();
  assert.deepEqual(kinds(viewTile("angles", st).items), ["anime", "manga", "movie", "tv"]);
  assert.deepEqual(kinds(viewTile("dmMovies", st).items), ["movie"]);
  assert.deepEqual(kinds(viewTile("dmTv", st).items), ["tv"]);
  assert.equal(viewTile("dmMovies", st).items.length, PICK_COUNT);
  assert.deepEqual(Object.keys(EXTRA).filter((k) => EXTRA[k].tmdb), ["dmMovies", "dmTv"]);   // their Reroll pages come from TMDB
});

test("Jump back in and New seasons are for anime and TV only", () => {
  const st = withCinema();
  st.jump = { anime: [show(800)], manga: [], tv: [serial(801)] };
  st.newSeasons = [show(850)]; st.newSeasonsTv = [serial(851, { season: 2 })];
  assert.deepEqual(ids(viewTile("jump", st).items), [800, 801]);
  assert.deepEqual(ids(viewTile("seasons", st).items), [850, 851]);
});

test("Most loved says where it comes from", () => {
  const st = withCinema();
  assert.match(viewTile("loved", st).subtitle, /anime, manga, novels, movies and TV/);
  assert.equal(viewTile("loved", { ...st, lovedFrom: "community" }).subtitle, "From the VoidPop community");
});

test("the anime tiles never fill up with movies, even when Most loved mixes every kind", () => {
  const st = withCinema();
  st.mostLoved = [film(1), serial(2), ...many(500, 10)];
  st.aoty = [];
  st.pools = { ...st.pools, popA: [], trA: [] };
  for (const key of ["aoty", "jump", "dmAnime"]) assert.ok(viewTile(key, st).items.every((x) => x.segment === "anime"), key);
});

// ---- the community rows (communityRank.js decides who is in; these check what the tiles do with it) ----
const comm = (from, n, segment = "anime") => Array.from({ length: n }, (_, i) => show(from + i, { segment }));

test("Best out there: hidden until the community has enough, then a fixed ranking without your marked titles", () => {
  const st = base();
  assert.equal(viewTile("best", st).hidden, true); // no community at all
  assert.equal(viewTile("best", { ...st, community: { best: comm(1, 5), popular: [], loved: [] } }).hidden, true); // too few
  // a title you marked is never suggested; it is not brought back from "last time" either
  const known = new Set(["anime:1", "anime:2"]);
  const v = viewTile("best", { ...st, known, last: { best: { title: "Best out there", items: comm(1, 8) } }, community: { best: comm(1, 7), popular: [], loved: [] } });
  assert.equal(v.hidden, true); // 7 minus 2 marked = 5 left
  const ok = viewTile("best", { ...st, community: { best: comm(1, 9), popular: [], loved: [] }, seeds: { best: 42 } });
  assert.deepEqual([ok.title, ok.reroll, ok.hidden], ["Best out there", false, undefined]);
  assert.deepEqual(ids(ok.items), ids(comm(1, 9))); // ranking order, whatever the seed
  assert.equal(ok.subtitle, "Loved by the VoidPop community");
});

test("Most loved and Popular in town use the community once it has 6+ titles, else their usual picks", () => {
  const st = base();
  const community = { best: [], popular: comm(1000, 8), loved: comm(2000, 7) };
  assert.equal(viewTile("loved", { ...st, community }).subtitle, "From the VoidPop community");
  assert.deepEqual(ids(viewTile("loved", { ...st, community }).items), ids(community.loved));
  assert.deepEqual(ids(viewTile("loved", { ...st, community: { best: [], popular: [], loved: comm(2000, 5) } }).items), ids(st.mostLoved.slice(0, 30)));
  assert.deepEqual(ids(viewTile("talk", { ...st, community }).items).sort(), ids(community.popular).sort());
  assert.ok(viewTile("talk", { ...st, community: null }).items.length >= 6); // trending mix as before
});

test("Also watch this mixes the kinds and repeats nothing the Don't Miss tiles or Angles show", () => {
  const st = base();
  st.pools = { ...st.pools, popMv: comm(3000, 60, "movie"), popTv: comm(4000, 60, "tv"), popN: comm(5000, 60, "novel") }; // about as deep as the real pools (3 TMDB pages each)
  const v = viewTile("watch", st);
  assert.equal(v.title, "Also watch this");
  assert.equal(v.reroll, true);
  assert.deepEqual([...new Set(v.items.map((x) => x.segment))].sort(), ["anime", "movie", "tv"]); // things you watch: never manga or novels
  const shown = new Set(["dmAnime", "dmManga", "dmNovels", "dmMovies", "dmTv", "angles"].flatMap((k) => viewTile(k, { ...st, last: null }).items.map((x) => `${x.segment}:${x.id}`)));
  assert.ok(v.items.every((x) => !shown.has(`${x.segment}:${x.id}`)));
  assert.equal(viewTile("watch", { ...st, pools: null }).loading, true);
});

test("Also watch this stays watchable when it runs short or falls back on what it showed last time", () => {
  const st = withCinema();
  st.pools = { ...st.pools, popA: [], popMv: [film(3000), film(3001)], popTv: [], popM: comm(200, 30, "manga"), popN: comm(5000, 30, "novel") };
  const short = viewTile("watch", st);
  assert.ok(short.items.length && short.items.every((x) => WATCHABLE.includes(x.segment))); // topped up, but not with manga or novels
  // a list saved before this change mixed all five kinds: only the watchable ones come back from it
  const old = { title: "Also watch this", items: [show(1), ...comm(2, 3, "manga"), film(4), ...comm(5, 3, "novel"), serial(6)] };
  const loading = viewTile("watch", { ...st, pools: null, last: { watch: old } });
  assert.deepEqual(loading.items.map((x) => x.segment), ["anime", "movie", "tv"]);
  assert.equal(loading.loading, false);
});

// ---- Popular in town: one kind at a time, switchable, starting on anime ----
const novel = (id) => show(id, { segment: "novel" });
const kindStub = () => {
  const st = withCinema();
  st.pools = { ...st.pools, popN: Array.from({ length: 20 }, (_, i) => novel(250 + i)), popM: comm(200, 20, "manga") };
  return st;
};

test("Popular in town has five chips and starts on anime", () => {
  assert.deepEqual(TALK_KINDS.map((k) => k.key), ["anime", "manga", "novel", "movie", "tv"]);
  assert.equal(TALK_DEFAULT, "anime");
  const st = kindStub();
  const dflt = viewTile("talk", st);
  assert.equal(dflt.title, "Popular in town"); // the title never changes with the chip
  assert.ok(dflt.items.length >= 6 && dflt.items.every((x) => x.segment === "anime"));
  assert.deepEqual(ids(dflt.items), ids(viewTile("talk", { ...st, talkKind: "anime" }).items)); // unset = anime
  assert.deepEqual(ids(dflt.items), ids(viewTile("talk", { ...st, talkKind: "nonsense" }).items)); // unknown = anime
});

test("Popular in town: each chip shows only its own kind, never topped up from another", () => {
  const st = kindStub();
  for (const k of TALK_KINDS) {
    const v = viewTile("talk", { ...st, talkKind: k.key });
    assert.ok(v.items.length >= 6, k.key);
    assert.ok(v.items.every((x) => x.segment === k.key), k.key);
    assert.equal(v.title, "Popular in town");
  }
  // a kind with only two titles stays at two: it is not padded with anime
  const thin = viewTile("talk", { ...st, talkKind: "novel", pools: { ...st.pools, popN: [novel(1), novel(2)] } });
  assert.deepEqual(thin.items.map((x) => x.segment), ["novel", "novel"]);
  assert.equal(thin.loading, false);
});

test("Popular in town: titles you marked are left out of every chip", () => {
  const st = kindStub();
  const first = viewTile("talk", { ...st, talkKind: "movie" }).items[0];
  const v = viewTile("talk", { ...st, talkKind: "movie", known: new Set([`movie:${first.id}`]) });
  assert.ok(!v.items.some((x) => x.id === first.id));
});

test("Popular in town: the community counts per kind, with that kind's own picks when it has too few", () => {
  const st = kindStub();
  const popular = [...comm(8000, 7, "manga"), ...comm(8100, 3, "anime"), ...comm(8200, 9, "movie")]; // a mixed ranking, as communityRank gives it
  const community = { best: [], popular, loved: [] };
  const manga = viewTile("talk", { ...st, community, talkKind: "manga" });
  assert.deepEqual(ids(manga.items).sort(), ids(popular.filter((x) => x.segment === "manga")).sort());
  assert.equal(manga.subtitle, "Most talked about in VoidPop");
  const movie = viewTile("talk", { ...st, community, talkKind: "movie" });
  assert.ok(movie.items.every((x) => x.segment === "movie") && movie.items.length === 9);
  // anime has only 3 community titles: not enough, so the usual anime picks and no community subtitle
  const anime = viewTile("talk", { ...st, community });
  assert.ok(anime.items.length >= 6 && anime.items.every((x) => x.segment === "anime"));
  assert.ok(!ids(anime.items).includes(8100) && anime.subtitle == null);
});

test("Popular in town: waiting for movies or TV shows loading, and never another kind's list from last time", () => {
  const st = kindStub();
  const lastAnime = { talk: { title: "Popular in town", subtitle: null, items: comm(1, 8) } };
  const noCinema = { ...st, pools: { ...st.pools, trMv: undefined, popMv: undefined, trTv: undefined, popTv: undefined }, last: lastAnime };
  const mv = viewTile("talk", { ...noCinema, talkKind: "movie" });
  assert.deepEqual([mv.loading, mv.items], [true, null]); // skeleton, not the saved anime
  // anime itself may still show what it showed last time while it loads
  assert.deepEqual(ids(viewTile("talk", { ...st, pools: null, last: lastAnime }).items), ids(comm(1, 8)));
  // a list saved when this row mixed every kind: only its anime come back on the anime chip
  const mixedLast = { talk: { title: "Popular in town", items: [show(1), ...comm(2, 3, "manga"), film(4)] } };
  assert.deepEqual(ids(viewTile("talk", { ...st, pools: null, last: mixedLast }).items), [1]);
  assert.equal(viewTile("talk", { ...st, pools: null, talkKind: "tv", last: lastAnime }).loading, true);
});

test("Popular in town still rerolls: a new seed gives another order of the same kind", () => {
  const st = { ...kindStub(), talkKind: "tv" };
  const a = viewTile("talk", st), b = viewTile("talk", { ...st, seeds: { talk: 4242 } });
  assert.equal(a.reroll, true);
  assert.notDeepEqual(ids(a.items), ids(b.items));
  assert.ok(b.items.every((x) => x.segment === "tv"));
});

test("Coming soon can be switched to one kind: only what is announced for it, soonest first, never topped up or brought back from the mix", () => {
  const st = withCinema();
  const all = viewTile("coming", st);
  assert.deepEqual([...new Set(all.items.map((x) => x.segment))].sort(), ["anime", "manga", "movie", "tv"]);
  const mv = viewTile("coming", { ...st, comingKind: "movie" });
  assert.deepEqual(ids(mv.items), [7002, 7001]); // two films, soonest first
  assert.equal(mv.reroll, false);
  assert.deepEqual(ids(viewTile("coming", { ...st, comingKind: "tv" }).items), [7101]);
  assert.deepEqual(ids(viewTile("coming", { ...st, comingKind: "manga" }).items), [7201]);
  assert.deepEqual(ids(viewTile("coming", { ...st, comingKind: "novel" }).items), [7401]);
  // nothing announced for a kind: say so, even though the mix has something to fall back on
  const none = viewTile("coming", { ...st, comingKind: "novel", pools: { ...st.pools, comingN: [] }, last: { coming: { title: "Coming soon", subtitle: null, items: all.items } } });
  assert.deepEqual([none.items.length, none.empty], [0, "Nothing announced for novels yet."]);
  // "all", or a kind we don't know, is the whole mix
  assert.deepEqual(ids(viewTile("coming", { ...st, comingKind: "all" }).items), ids(all.items));
  assert.deepEqual(ids(viewTile("coming", { ...st, comingKind: "bogus" }).items), ids(all.items));
});

// Explore's fixed tiles: titles never change, only the shows (and only on Reroll).
import { test } from "node:test";
import assert from "node:assert/strict";
import { TILES, EXTRA, viewTile, seededShuffle, dedupe, poolFor, chosenSource, nextSource, PICK_COUNT } from "../features/exploreTiles.js";

const show = (id, extra = {}) => ({ id, segment: "anime", title: `Show ${id}`, ...extra });
const many = (from, n) => Array.from({ length: n }, (_, i) => show(from + i));
const ids = (items) => items.map((x) => x.id);
const base = () => ({
  pools: { trA: many(1, 40), popA: many(100, 60), popM: many(200, 30).map((x) => ({ ...x, segment: "manga" })), popN: [], coming: [], isekai: many(300, 30), shonen: many(400, 30) },
  known: new Set(), aoty: [show(900), show(901)], mostLoved: many(500, 40), trend: many(600, 40), country: "KR",
  verdicts: { peak: { source: show(7, { title: "Death Note" }), items: many(700, 25) }, divein: { source: null, items: [] }, onetime: { source: null, items: [] } },
  newSeasons: [], jump: { anime: [show(800), show(801)], manga: [] }, seeds: {}, saved: {}, extra: {}, busy: {},
});

test("14 tiles with unique keys; the fixed lists can't be rerolled", () => {
  assert.equal(TILES.length, 14);
  assert.equal(new Set(TILES.map((t) => t.key)).size, 14);
  assert.ok(!TILES.some((t) => ["isekai", "shonen"].includes(t.key))); // Isekai Heaven and Shonen Feast are gone: those are genres in Browse now
  assert.deepEqual(TILES.filter((t) => !t.reroll).map((t) => t.key), ["loved", "trending", "coming", "aoty", "jump", "seasons"]);
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

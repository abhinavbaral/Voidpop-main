// Explore as a fixed grid of tiles (like Spotify's Search page). The titles never
// change or disappear; only the shows inside them do, and only on Reroll (or when you
// pull down to refresh, which rerolls every tile that can be rerolled).
//
// Fixed lists have no Reroll: Most loved and Trending (rankings), Coming soon (soonest
// first), Anime of the Year (the winners), Jump back in and New seasons (your own shows).
//
// A tile is never empty: when its own list runs dry it tops up from related shows,
// or shows what it showed last time (see viewTile).
//
// Plain functions, no storage and no screens: viewTile() turns the Explore state
// into what one tile (and its category page) shows.

import { genreFilter } from "./genreRows.js";

export const PICK_COUNT = 18; // shows in a category
const RANKING_COUNT = 30; // Most loved and Trending

// key, the tile's fixed title, its colour, and whether it can be rerolled
export const TILES = [
  { key: "peak", title: "Peak like", verdict: "Peak", color: "#e8115b", reroll: true },
  { key: "divein", title: "Dive in like", verdict: "Dive In", color: "#8d67ab", reroll: true },
  { key: "onetime", title: "One time like", verdict: "One Time", color: "#477d95", reroll: true },
  { key: "talk", title: "Talk of the Week", color: "#dc148c", reroll: true },
  { key: "loved", title: "Most loved", color: "#e13300", reroll: false },
  { key: "trending", title: "Trending in", color: "#1e3264", reroll: false },
  { key: "coming", title: "Coming soon", color: "#006450", reroll: false },
  { key: "aoty", title: "Anime of the Year", color: "#ba5d07", reroll: false },
  { key: "jump", title: "Jump back in", color: "#503750", reroll: false },
  { key: "seasons", title: "New seasons of shows you watched", color: "#7358ff", reroll: false },
  { key: "dmAnime", title: "Don't Miss This — Anime", color: "#148a08", reroll: true },
  { key: "dmManga", title: "Don't Miss This — Manga", color: "#af2896", reroll: true },
  { key: "dmNovels", title: "Don't Miss This — Novels", color: "#0d73ec", reroll: true },
  { key: "isekai", title: "Isekai Heaven", color: "#608108", reroll: true },
  { key: "shonen", title: "Shonen Feast", color: "#d84000", reroll: true },
  { key: "angles", title: "VoidPop Angles", color: "#509bf5", reroll: true },
];

// Where Reroll can fetch more shows from AniList (a random page; the picks then draw
// from the bigger pool). Categories not listed here reshuffle what they already have.
export const EXTRA = {
  talk: { segment: "anime", sort: "trending", maxPage: 4 },
  dmAnime: { segment: "anime", sort: "popular", maxPage: 8 },
  dmManga: { segment: "manga", sort: "popular", maxPage: 8 },
  dmNovels: { segment: "novel", sort: "popular", maxPage: 8 },
  isekai: { segment: "anime", sort: "popular", maxPage: 4 }, // + genreQuery("isekai")
  shonen: { segment: "anime", sort: "popular", maxPage: 3 }, // + genreQuery("shonen"): the top pages
  angles: { segment: "anime", sort: "popular", maxPage: 10 },
};

const keyOf = (it) => `${it.segment}:${it.id}`;

export function dedupe(items) {
  const seen = new Set();
  return (items || []).filter((it) => !seen.has(keyOf(it)) && seen.add(keyOf(it)));
}

// the same seed always gives the same order (so the picks stay put until you reroll)
export function seededShuffle(items, seed) {
  const a = [...items];
  let s = seed >>> 0 || 1;
  const rnd = () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
// seed 0 = never rerolled: the list as it comes
const mix = (items, seed) => (seed ? seededShuffle(items, seed) : items);

const COUNTRY_LABEL = { JP: "Japan", KR: "Korea", CN: "China" };
const MIN_SHOWN = 6; // a tile with fewer shows than this gets topped up

// the unmarked shows a Reroll tile draws from (its AniList pages plus anything Reroll fetched)
const POOL_OF = { talk: "trA", dmAnime: "popA", dmManga: "popM", dmNovels: "popN", isekai: "isekai", shonen: "shonen", angles: "popA" };
export function poolFor(key, st) {
  const base = st.pools?.[POOL_OF[key]];
  if (!base) return [];
  const known = st.known || new Set();
  return dedupe(genreFilter(key, [...base, ...(st.extra?.[key] || [])])).filter((it) => !known.has(keyOf(it)));
}

// Which of your titles a verdict tile is "like": the one you reached last time if you still have it with that
// verdict, else your most recent. choiceKey = "anime:123" or undefined.
export function chosenSource(sources, choiceKey) {
  return (sources || []).find((s) => keyOf(s) === choiceKey) || (sources || [])[0] || null;
}
// Where Reroll moves a verdict tile: another of your titles (never the same one while you have more than one).
// random = a function returning 0..1 (Math.random; tests pass their own).
export function nextSource(sources, current, random = Math.random) {
  const list = sources || [];
  const others = list.filter((s) => !current || keyOf(s) !== keyOf(current));
  const pool = others.length ? others : list;
  return pool.length ? pool[Math.floor(random() * pool.length) % pool.length] : null;
}

// What one tile shows. st = the Explore state:
//   pools, aoty, mostLoved, trend, country, verdicts ({ source, items } per verdict), newSeasons, jump, jumpFallback   (null/undefined while loading)
//   known (library + Excited keys), seeds, extra (more shows fetched by Reroll), saved (picks kept from the last Reroll),
//   last (what each tile showed last time: { title, subtitle, items })
// → { key, title, subtitle, color, reroll, items, loading, empty }
export function viewTile(key, st) {
  const v = compute(key, st);
  const last = st.last?.[key];
  const keepLast = () => (key === "jump" || key === "aoty" ? last.items : (last.items || []).filter((it) => !(st.known || new Set()).has(keyOf(it))));
  if (v.items === null && last?.items?.length) { // still loading: what it showed last time, right away
    return { ...v, title: last.title || v.title, subtitle: last.subtitle ?? v.subtitle, items: keepLast(), loading: false };
  }
  if (v.items && !v.items.length && last?.items?.length) { // nothing to show now: what it showed last time
    const items = keepLast();
    if (items.length) return { ...v, title: last.title || v.title, subtitle: last.subtitle ?? v.subtitle, items, empty: null };
  }
  if (v.items && !v.items.length) return { ...v, empty: "Can't load shows right now. Check your connection and pull down to try again." };
  return v;
}

function compute(key, st) {
  const def = TILES.find((t) => t.key === key);
  const known = st.known || new Set();
  const fresh = (items) => (items || []).filter((it) => !known.has(keyOf(it)));
  const seed = def.reroll ? st.seeds?.[key] || 0 : 0; // fixed lists ignore it
  const out = (items, more = {}) => ({ key, title: def.title, subtitle: null, color: def.color, reroll: def.reroll, items, loading: false, empty: null, ...more });
  const wait = (more = {}) => out(null, { loading: true, ...more });
  // never short: top a list up from related shows (unmarked, not already in it)
  const topUp = (items, backups, count = PICK_COUNT) => {
    if (items.length >= MIN_SHOWN) return { items, topped: false };
    const have = new Set(items.map(keyOf));
    const more = dedupe(fresh(backups)).filter((it) => !have.has(keyOf(it)));
    return { items: [...items, ...more].slice(0, count), topped: more.length > 0 };
  };
  const popular = () => [...(st.pools?.popA || []), ...(st.pools?.trA || []), ...(st.mostLoved || [])];
  // picks from a pool: the ones kept at the last Reroll if most are still unmarked, else the seeded draw
  const draw = (list, count = PICK_COUNT) => {
    const kept = fresh(st.saved?.[key]);
    if (EXTRA[key] && kept.length >= MIN_SHOWN) return kept.slice(0, count);
    return mix(list, seed).slice(0, count);
  };
  const byDate = (a, b) => (a.date ? 0 : 1) - (b.date ? 0 : 1) || (a.date || "").localeCompare(b.date || "");

  if (def.verdict) {
    const v = st.verdicts?.[key];
    if (!v) return wait({ title: `${def.title} …` });
    const own = mix(fresh(v.items), seed).slice(0, PICK_COUNT);
    // no verdict of this kind yet (or nothing new like it): what people love, until you have one
    const t = topUp(own, mix([...(st.mostLoved || []), ...(st.pools?.popA || [])], seed || 1));
    return out(t.items, {
      title: `${def.title} ${v.source ? v.source.title : "…"}`,
      subtitle: t.topped ? (v.source ? "Plus what people love" : `Popular picks until you give a title the ${def.verdict} verdict`) : null,
    });
  }

  switch (key) {
    case "loved": {
      if (st.mostLoved == null) return wait();
      return out(fresh(st.mostLoved).slice(0, RANKING_COUNT));
    }
    case "trending": {
      const where = COUNTRY_LABEL[st.country] || "Japan";
      if (st.trend == null) return wait({ title: `${def.title} ${where}` });
      return out(fresh(st.trend).slice(0, RANKING_COUNT), { title: `${def.title} ${where}` });
    }
    case "coming": {
      if (!st.pools) return wait();
      const yours = new Set((st.newSeasons || []).map((it) => it.id)); // sequels of shows you watched live in "New seasons"
      const list = dedupe(fresh(st.pools.coming)).filter((it) => !yours.has(it.id));
      const items = [...list].sort(byDate).slice(0, 24); // soonest first
      const label = st.pools.comingChip?.label || null;
      if (items.length < MIN_SHOWN) { // nothing announced: what everyone's watching
        const t = topUp(items, st.pools.trA);
        return out(t.items, { title: st.pools.comingTitle || def.title, subtitle: t.topped ? "Nothing more announced yet. What everyone's watching" : label });
      }
      return out(items, { title: st.pools.comingTitle || def.title, subtitle: label });
    }
    case "aoty": {
      if (st.aoty == null) return wait({ subtitle: "Crunchyroll Awards" });
      if (st.aoty.length) return out(st.aoty, { subtitle: "Crunchyroll Awards" }); // may include shows you've watched
      return out(fresh(st.mostLoved).slice(0, PICK_COUNT), { subtitle: "Winners can't load yet. Most loved instead" });
    }
    case "jump": {
      if (st.jump == null) return wait();
      const left = st.jump.anime || [];
      if (left.length) return out(left); // your own library, so not filtered
      if (st.jumpFallback?.length) return out(st.jumpFallback, { subtitle: "Nothing left behind. Still on your list" });
      const t = topUp([], [...(st.trend || []), ...popular()]);
      return out(t.items, { subtitle: "Nothing started yet. Trending picks" });
    }
    case "seasons": {
      if (st.newSeasons == null) return wait();
      if (st.newSeasons.length >= 1) return out(st.newSeasons);
      const t = topUp([], [...dedupe(st.pools?.coming || []).sort(byDate), ...(st.pools?.trA || [])]);
      return out(t.items, { subtitle: "No new seasons of your shows yet. Coming soon instead" });
    }
    case "talk": case "dmAnime": case "dmManga": case "dmNovels": case "isekai": case "shonen": {
      if (!st.pools) return wait();
      const backups = key === "dmManga" ? st.pools.popM : key === "dmNovels" ? st.pools.popN : popular();
      const t = topUp(draw(poolFor(key, st)), backups);
      return out(t.items, { subtitle: t.topped && (key === "isekai" || key === "shonen") ? "Not many left. Popular picks too" : null });
    }
    case "angles": {
      if (!st.pools) return wait();
      // never repeats what Don't Miss This — Anime shows right now
      const shown = new Set((viewTile("dmAnime", { ...st, last: null }).items || []).map(keyOf));
      const rest = poolFor(key, st).filter((it) => !shown.has(keyOf(it)));
      const t = topUp(draw(rest.length ? rest : poolFor(key, st)), popular());
      return out(t.items);
    }
    default: return out([]);
  }
}

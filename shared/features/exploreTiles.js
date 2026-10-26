// Explore as a fixed grid of tiles (like Spotify's Search page). The titles never
// change or disappear; only the shows inside them do, and only on Reroll (or when you
// pull down to refresh, which rerolls every tile that can be rerolled).
//
// Fixed lists have no Reroll: Most loved, Best out there and Trending (rankings), Coming soon (soonest
// first), the award winners (Anime of the Year, Oscars, Emmys), Jump back in and New seasons (your own
// anime and TV). Popular in town shows one kind at a time (anime to start; you switch it with chips) and
// Also watch this mixes only what you can watch: anime, movies and TV. Everything else mixes all five kinds.
//
// A tile is never empty: when its own list runs dry it tops up from related shows,
// or shows what it showed last time (see viewTile).
//
// Plain functions, no storage and no screens: viewTile() turns the Explore state
// into what one tile (and its category page) shows.

import { interleave } from "./exploreMix.js";

export const PICK_COUNT = 18; // shows in a category
const RANKING_COUNT = 30; // Most loved and Trending

// key, the tile's fixed title, its colour, and whether it can be rerolled
export const TILES = [
  { key: "peak", title: "Peak like", verdict: "Peak", color: "#e8115b", reroll: true },
  { key: "divein", title: "Dive in like", verdict: "Dive In", color: "#8d67ab", reroll: true },
  { key: "onetime", title: "One time like", verdict: "One Time", color: "#477d95", reroll: true },
  { key: "talk", title: "Popular in town", color: "#dc148c", reroll: true },
  { key: "best", title: "Best out there", color: "#2d46b9", reroll: false }, // community only: hidden until people have given verdicts
  { key: "watch", title: "Also watch this", color: "#7d4b32", reroll: true },
  { key: "loved", title: "Most loved", color: "#e13300", reroll: false },
  { key: "trending", title: "Trending in", color: "#1e3264", reroll: false },
  { key: "coming", title: "Coming soon", color: "#006450", reroll: false },
  { key: "aoty", title: "Anime of the Year", color: "#ba5d07", reroll: false },
  { key: "oscars", title: "Oscars", color: "#a1741a", reroll: false },
  { key: "emmys", title: "Emmys", color: "#8c2f39", reroll: false },
  { key: "jump", title: "Jump back in", color: "#503750", reroll: false },
  { key: "seasons", title: "New seasons of shows you watched", color: "#7358ff", reroll: false },
  { key: "dmAnime", title: "Don't Miss This — Anime", color: "#148a08", reroll: true },
  { key: "dmManga", title: "Don't Miss This — Manga", color: "#af2896", reroll: true },
  { key: "dmNovels", title: "Don't Miss This — Novels", color: "#0d73ec", reroll: true },
  { key: "dmMovies", title: "Don't Miss This — Movies", color: "#c0392b", reroll: true },
  { key: "dmTv", title: "Don't Miss This — TV", color: "#0e7490", reroll: true },
  { key: "angles", title: "VoidPop Angles", color: "#509bf5", reroll: true },
];

// What Explore shows, in order. The grid is the colourful tiles; the rows are posters in lines, each mixing
// anime, manga, novels, movies and TV.
export const GRID_KEYS = ["coming", "aoty", "oscars", "emmys", "jump", "seasons", "dmAnime", "dmManga", "dmMovies", "dmNovels", "dmTv", "angles", "trending"];
// The kinds you can switch Coming soon between (the chips on its page); "all" is every kind together
export const COMING_KINDS = [
  { key: "all", label: "All" }, { key: "anime", label: "Anime" }, { key: "manga", label: "Manga" },
  { key: "novel", label: "Novels" }, { key: "movie", label: "Movies" }, { key: "tv", label: "TV" },
];
const COMING_NAME = { anime: "anime", manga: "manga", novel: "novels", movie: "movies", tv: "TV shows" };

// The kinds you can switch Popular in town between (the chips on its row and its page). One kind at a time, no "all";
// it always starts on anime.
export const TALK_KINDS = [
  { key: "anime", label: "Anime" }, { key: "manga", label: "Manga" }, { key: "novel", label: "Novels" },
  { key: "movie", label: "Movies" }, { key: "tv", label: "TV" },
];
export const TALK_DEFAULT = "anime";
const talkKindOf = (st) => (TALK_KINDS.some((k) => k.key === st?.talkKind) ? st.talkKind : TALK_DEFAULT);
// Also watch this is for things you watch: no manga, no novels
export const WATCH_KINDS = ["anime", "movie", "tv"];

export const ROW_KEYS = ["talk", "best", "watch", "peak", "divein", "onetime", "loved"];

// Where Reroll can fetch more shows from AniList (a random page; the picks then draw
// from the bigger pool). Categories not listed here reshuffle what they already have.
export const EXTRA = {
  dmAnime: { segment: "anime", sort: "popular", maxPage: 8 },
  dmManga: { segment: "manga", sort: "popular", maxPage: 8 },
  dmNovels: { segment: "novel", sort: "popular", maxPage: 8 },
  dmMovies: { tmdb: "movie", sort: "popular", maxPage: 8 }, // movies and TV come from TMDB, the rest from AniList
  dmTv: { tmdb: "tv", sort: "popular", maxPage: 8 },
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
const POOL_OF = { dmAnime: "popA", dmManga: "popM", dmNovels: "popN", dmMovies: "popMv", dmTv: "popTv" };
// Also watch this mixes anime, movies and TV; VoidPop Angles mixes all five kinds, taken in turns
const MIXED = {
  watch: (p) => [p.popMv, p.popTv, p.popA],
  angles: (p) => [p.popA, p.popM, p.popN, p.popMv, p.popTv],
};
// Popular in town, one kind at a time: what is trending now first, then what is popular
const TALK_POOLS = {
  anime: (p) => [p.trA, p.popA], manga: (p) => [p.popM], novel: (p) => [p.popN],
  movie: (p) => [p.trMv, p.popMv], tv: (p) => [p.trTv, p.popTv],
};
export function poolFor(key, st) {
  const base = MIXED[key] && st.pools ? interleave(MIXED[key](st.pools), 200) : st.pools?.[POOL_OF[key]];
  if (!base) return [];
  const known = st.known || new Set();
  return dedupe([...base, ...(st.extra?.[key] || [])]).filter((it) => !known.has(keyOf(it)));
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
//   community ({ best, popular, loved } from communityRank.js, or null with no server / too few verdicts)
//   pools, aoty, mostLoved, trend, country, verdicts ({ source, items } per verdict), newSeasons, jump, jumpFallback   (null/undefined while loading)
//   comingKind ("all" or unset, or one of anime / manga / novel / movie / tv: what Coming soon is switched to)
//   known (library + Excited keys), seeds, extra (more shows fetched by Reroll), saved (picks kept from the last Reroll),
//   last (what each tile showed last time: { title, subtitle, items })
// → { key, title, subtitle, color, reroll, items, loading, empty, hidden }
// hidden = leave the row out altogether (Best out there until the community has enough verdicts); never
// brought back from what it showed last time.
export function viewTile(key, st) {
  const v = compute(key, st);
  if (v.hidden) return v;
  const last = st.last?.[key];
  // what it showed last time may hold kinds the tile no longer shows (it used to mix all five): leave those out
  const only = key === "watch" ? WATCH_KINDS : key === "talk" ? [talkKindOf(st)] : null;
  const keepLast = () => (key === "jump" || key === "aoty" ? last.items
    : (last.items || []).filter((it) => !(st.known || new Set()).has(keyOf(it)) && (!only || only.includes(it.segment))));
  if (v.items === null && !v.noLast && last?.items?.length) { // still loading: what it showed last time, right away
    const items = keepLast();
    if (items.length) return { ...v, title: last.title || v.title, subtitle: last.subtitle ?? v.subtitle, items, loading: false };
  }
  if (v.items && !v.items.length && !v.noLast && last?.items?.length) { // nothing to show now: what it showed last time
    const items = keepLast();
    if (items.length) return { ...v, title: last.title || v.title, subtitle: last.subtitle ?? v.subtitle, items, empty: null };
  }
  if (v.items && !v.items.length && !v.empty) return { ...v, empty: "Can't load shows right now. Check your connection and pull down to try again." };
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
  // anime only: the anime tiles must never fill up with movies (Most loved now mixes every kind)
  const popular = () => [...(st.pools?.popA || []), ...(st.pools?.trA || []), ...(st.mostLoved || []).filter((it) => it.segment === "anime")];
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
    case "best": {
      // Peak for 70%+ of the people who finished it (communityRank.js). Nothing to fall back on: it needs people.
      const c = fresh(st.community?.best);
      if (c.length < MIN_SHOWN) return out([], { hidden: true });
      return out(c.slice(0, RANKING_COUNT), { subtitle: "Loved by the VoidPop community" });
    }
    case "loved": {
      const c = fresh(st.community?.loved);
      if (c.length >= MIN_SHOWN) return out(c.slice(0, RANKING_COUNT), { subtitle: "From the VoidPop community" });
      if (st.mostLoved == null) return wait();
      // what the VoidPop community loves once enough people have given verdicts, until then a mix of everything's most loved
      return out(fresh(st.mostLoved).slice(0, RANKING_COUNT), {
        subtitle: st.lovedFrom === "community" ? "From the VoidPop community" : "Across anime, manga, novels, movies and TV",
      });
    }
    case "trending": {
      const where = COUNTRY_LABEL[st.country] || "Japan";
      if (st.trend == null) return wait({ title: `${def.title} ${where}` });
      return out(fresh(st.trend).slice(0, RANKING_COUNT), { title: `${def.title} ${where}` });
    }
    case "coming": {
      if (!st.pools) return wait();
      const yours = new Set((st.newSeasons || []).map((it) => it.id)); // sequels of shows you watched live in "New seasons"
      // everything that hasn't come out yet (anime, manga, novels, movies, TV), or just the kind it's switched to
      const p = st.pools;
      const byKind = { anime: p.coming, manga: p.comingM, novel: p.comingN, movie: p.comingMv, tv: p.comingTv };
      const kind = byKind[st.comingKind] ? st.comingKind : null;
      const pool = kind ? byKind[kind] : [...(p.coming || []), ...(p.comingMv || []), ...(p.comingTv || []), ...(p.comingM || []), ...(p.comingN || [])];
      const list = dedupe(fresh(pool)).filter((it) => !(it.segment === "anime" && yours.has(it.id)));
      const items = [...list].sort(byDate).slice(0, 24); // soonest first
      const label = st.pools.comingChip?.label || null;
      if (kind) { // one kind: only what is announced for it, never topped up with other kinds or what's popular
        return out(items, { title: st.pools.comingTitle || def.title, subtitle: label, noLast: true, empty: items.length ? null : `Nothing announced for ${COMING_NAME[kind]} yet.` });
      }
      if (items.length < MIN_SHOWN) { // nothing announced: what everyone's watching
        const t = topUp(items, interleave([st.pools.trA, st.pools.trMv, st.pools.trTv], 24));
        return out(t.items, { title: st.pools.comingTitle || def.title, subtitle: t.topped ? "Nothing more announced yet. What everyone's watching" : label });
      }
      return out(items, { title: st.pools.comingTitle || def.title, subtitle: label });
    }
    case "aoty": {
      if (st.aoty == null) return wait({ subtitle: "Crunchyroll Awards" });
      if (st.aoty.length) return out(st.aoty, { subtitle: "Crunchyroll Awards" }); // may include shows you've watched
      return out(fresh(st.mostLoved).filter((it) => it.segment === "anime").slice(0, PICK_COUNT), { subtitle: "Winners can't load yet. Most loved instead" });
    }
    case "oscars": case "emmys": {
      const list = st[key];
      const award = key === "oscars" ? "Best Picture winners" : "Drama and comedy series winners";
      if (list == null) return wait({ subtitle: award });
      if (list.length) return out(list, { subtitle: award }); // may include titles you've watched
      return out(fresh(key === "oscars" ? st.pools?.topMv : st.pools?.topTv).slice(0, PICK_COUNT), { subtitle: "Winners can't load yet. Top rated instead" });
    }
    case "jump": {
      if (st.jump == null) return wait();
      const left = interleave([st.jump.anime || [], st.jump.tv || []], 24); // anime and TV
      if (left.length) return out(left); // your own library, so not filtered
      if (st.jumpFallback?.length) return out(st.jumpFallback, { subtitle: "Nothing left behind. Still on your list" });
      const t = topUp([], [...(st.trend || []), ...popular()]);
      return out(t.items, { subtitle: "Nothing started yet. Trending picks" });
    }
    case "seasons": {
      if (st.newSeasons == null) return wait();
      const both = dedupe([...st.newSeasons, ...(st.newSeasonsTv || [])]); // anime sequels and new seasons of your series
      if (both.length >= 1) return out(both);
      const t = topUp([], [...dedupe(st.pools?.coming || []).sort(byDate), ...(st.pools?.trA || [])]);
      return out(t.items, { subtitle: "No new seasons of your shows yet. Coming soon instead" });
    }
    case "watch": {
      if (!st.pools) return wait();
      // a mix of anime, movies and TV (never manga or novels) that none of the Don't Miss This tiles or VoidPop Angles is showing right now
      const shown = new Set(["dmAnime", "dmManga", "dmNovels", "dmMovies", "dmTv", "angles"].flatMap((k) => (viewTile(k, { ...st, last: null }).items || []).map(keyOf)));
      const lists = MIXED.watch(st.pools).map((l) => (l || []).filter((it) => !known.has(keyOf(it)) && !shown.has(keyOf(it))));
      const rest = interleave(lists, 200);
      const t = topUp(draw(rest), interleave(MIXED.watch(st.pools), 30)); // topped up with watchable kinds only
      return out(t.items);
    }
    case "talk": {
      // one kind at a time (anime unless switched). Only the community's titles of that kind, once there are enough of them
      // (the split is by kind, so a kind can have too few while another has plenty), else that kind's trending and popular.
      // Never topped up from another kind: the chip says what is inside. noLast: what it showed last time is another kind.
      const kind = talkKindOf(st);
      const noLast = kind !== TALK_DEFAULT;
      const c = fresh(st.community?.popular).filter((it) => it.segment === kind);
      if (c.length >= MIN_SHOWN) return out(mix(c, seed).slice(0, PICK_COUNT), { subtitle: "Most talked about in VoidPop", noLast });
      if (!st.pools) return wait({ noLast });
      const p = st.pools;
      if ((kind === "movie" && !p.trMv && !p.popMv) || (kind === "tv" && !p.trTv && !p.popTv)) return wait({ noLast }); // movies and TV load a moment after anime
      const list = dedupe(fresh(TALK_POOLS[kind](p).flatMap((l) => l || [])));
      return out(draw(list), { noLast });
    }
    case "dmAnime": case "dmManga": case "dmNovels": case "dmMovies": case "dmTv": {
      if (!st.pools) return wait();
      if ((key === "dmMovies" && !st.pools.popMv) || (key === "dmTv" && !st.pools.popTv)) return wait(); // movies and TV load a moment after anime
      const backups = { dmManga: st.pools.popM, dmNovels: st.pools.popN, dmMovies: st.pools.popMv, dmTv: st.pools.popTv }[key] || popular();
      const t = topUp(draw(poolFor(key, st)), backups);
      return out(t.items);
    }
    case "angles": {
      if (!st.pools) return wait();
      // never repeats what the Don't Miss This tiles show right now; still takes all five kinds in turns
      const shown = new Set(["dmAnime", "dmManga", "dmNovels", "dmMovies", "dmTv"].flatMap((k) => (viewTile(k, { ...st, last: null }).items || []).map(keyOf)));
      const kindLists = MIXED.angles(st.pools).map((l) => (l || []).filter((it) => !known.has(keyOf(it)) && !shown.has(keyOf(it))));
      const rest = interleave(kindLists, 200);
      const t = topUp(draw(rest.length ? rest : poolFor(key, st)), interleave([st.pools.popA, st.pools.popM, st.pools.popN, st.pools.popMv, st.pools.popTv], 30));
      return out(t.items);
    }
    default: return out([]);
  }
}

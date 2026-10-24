// The Explore data, shared by the Explore grid and the category pages (a tiny
// store: both read it with useExplore(), the actions below change it).
// Loading is done here so a category page opens with what the grid already fetched.
import { useSyncExternalStore } from "react";
import { readKey, writeKey } from "@voidpop/shared/backend/storage";
import { fetchAniList } from "@voidpop/shared/api/anilist";
import { fetchCinema } from "@voidpop/shared/api/tmdb";
import { loadExplorePools, knownKeys, loadVerdictSources, loadRecsLike, loadNewSeasons, loadAnimeOfTheYear, loadJumpBackIn, loadInProgress } from "@voidpop/shared/features/explore";
import { loadCinemaPools, loadComingBooks, loadAwards, loadNewSeasonsTv, loadMostLoved } from "@voidpop/shared/features/exploreCinema";
import { loadCommunityRows } from "@voidpop/shared/features/exploreCommunity";
import { likeMix } from "@voidpop/shared/features/exploreMix";
import { TILES, EXTRA, PICK_COUNT, viewTile, dedupe, poolFor, chosenSource, nextSource } from "@voidpop/shared/features/exploreTiles";

const SEEDS_KEY = "voidation:explore:seeds:v1"; // { tileKey: seed }: the order each tile was last rerolled to
const SAVED_KEY = "voidation:explore:picks:v1"; // { tileKey: [shows] }: what a rerolled tile showed, kept so it stays put
const VERDICT_KEY = "voidation:explore:verdict:v1"; // { peak: "anime:123", … }: which of your titles each verdict tile is "like"
const LAST_KEY = "voidation:explore:last:v1"; // { tileKey: { title, subtitle, items } }: what every tile showed last time, so none is ever empty or blank

let state = {
  pools: null, known: new Set(), community: null, aoty: null, mostLoved: null, trend: null, country: "JP",
  verdicts: null, verdictSources: null, verdictChoice: {}, newSeasons: null, newSeasonsTv: null, jump: null, jumpFallback: [],
  oscars: null, emmys: null, lovedFrom: "mixed", billboardSeed: Math.floor(Math.random() * 1e9), // a new Billboard title on every refresh
  seeds: {}, saved: {}, extra: {}, busy: {}, last: {},
};
const listeners = new Set();
const set = (patch) => { state = { ...state, ...patch }; listeners.forEach((l) => l()); scheduleLast(); };

// remember what each tile shows (a moment after things settle), for the next launch and for when a list runs dry
let lastTimer = null;
function scheduleLast() {
  clearTimeout(lastTimer);
  lastTimer = setTimeout(() => {
    const last = { ...state.last };
    let changed = false;
    TILES.forEach((t) => {
      const v = viewTile(t.key, { ...state, last: null });
      if (v.items?.length) { last[t.key] = { title: v.title, subtitle: v.subtitle, items: v.items.slice(0, PICK_COUNT) }; changed = true; }
    });
    if (!changed) return;
    state = { ...state, last }; // no notify: nothing on screen changes
    writeKey(LAST_KEY, JSON.stringify(last)).catch(() => {});
  }, 2500);
}
export const getExplore = () => state;
export const useExplore = () => useSyncExternalStore((cb) => { listeners.add(cb); return () => listeners.delete(cb); }, () => state);

// the pools load in parts (AniList, then movies and TV, then upcoming manga and novels): each part adds to what is there
const EMPTY_POOLS = { trA: [], popA: [], popM: [], popN: [], coming: [] };
const mergePools = (patch) => set({ pools: { ...(state.pools || EMPTY_POOLS), ...patch } });
// one more page of a Reroll source: movies and TV from TMDB, everything else from AniList
const fetchMore = (src, page) => (src.tmdb
  ? fetchCinema(src.tmdb, { sort: src.sort, page }).then((r) => r.items)
  : fetchAniList(src.segment, { sort: src.sort, perPage: 25, page, ...(src.tag ? { tag: src.tag } : {}) }).then((r) => r.items));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const VERDICTS = ["peak", "divein", "onetime"];
const srcKey = (it) => `${it.segment}:${it.id}`;
const recsCache = new Map(); // "anime:123" → its recommendations (kept for the session)
const recsFor = async (source) => {
  if (!recsCache.has(srcKey(source))) recsCache.set(srcKey(source), await loadRecsLike(source));
  return recsCache.get(srcKey(source));
};
const NO_VERDICTS = { peak: { source: null, items: [] }, divein: { source: null, items: [] }, onetime: { source: null, items: [] } };

// each verdict tile: the title it is "like" (your choice from the last Reroll, else your most recent) and picks like it
// Peak like One Piece: its own recommendations plus a few movies, series, anime, novels and manga that share its genres
const mixed = (source, recs) => {
  const p = state.pools || {};
  return likeMix(source, recs, { anime: p.popA, manga: p.popM, novel: p.popN, movie: p.popMv, tv: p.popTv });
};
async function buildVerdicts() {
  const sources = state.verdictSources || {};
  const out = {};
  await Promise.all(VERDICTS.map(async (v) => {
    const source = chosenSource(sources[v], state.verdictChoice[v]);
    let items = [];
    if (source) { try { items = await recsFor(source); } catch { /* offline: the tile tops itself up */ } }
    out[v] = { source, items: source ? mixed(source, items) : items };
  }));
  set({ verdicts: out });
}
let savedRead = false;

// what you've added to your library or Excited list, your verdict tiles, new seasons and "jump back in"
export async function refreshPersonal() {
  await Promise.all([
    knownKeys().then((known) => set({ known })).catch(() => {}),
    loadVerdictSources().then((verdictSources) => { set({ verdictSources }); return buildVerdicts(); }).catch(() => set({ verdicts: state.verdicts || NO_VERDICTS })),
    loadNewSeasons().then((newSeasons) => set({ newSeasons })).catch(() => set({ newSeasons: state.newSeasons || [] })),
    loadNewSeasonsTv().then((newSeasonsTv) => set({ newSeasonsTv })).catch(() => set({ newSeasonsTv: state.newSeasonsTv || [] })),
    loadJumpBackIn().then((jump) => set({ jump })).catch(() => set({ jump: state.jump || { anime: [], manga: [], tv: [] } })),
    loadInProgress().then((jumpFallback) => set({ jumpFallback })).catch(() => {}),
  ]);
}

export async function loadTrend(country = state.country) {
  set({ country, trend: null });
  try {
    const r = await fetchAniList("anime", { sort: "trending", origin: country, perPage: 50 });
    if (state.country === country) set({ trend: r.items });
  } catch { if (state.country === country) set({ trend: [] }); }
}

// A pool thinned out by what's in your library gets more pages from AniList (up to two) so its tile stays full.
async function topUpPools() {
  await Promise.all(Object.keys(EXTRA).map(async (key) => {
    const src = EXTRA[key];
    let extra = state.extra[key] || [];
    for (let page = 2; page <= 3 && poolFor(key, { ...state, extra }).length < PICK_COUNT; page++) {
      try {
        extra = dedupe([...extra, ...(await fetchMore(src, page))]);
      } catch { break; }
    }
    if (extra.length !== (state.extra[key] || []).length) set({ extra: { ...state.extra, [key]: extra.slice(0, 150) } });
  }));
}

// the first load, and the reload behind pull-to-refresh (which then calls rerollAll)
export async function initExplore() {
  if (!savedRead) {
    savedRead = true;
    try { set({ seeds: JSON.parse((await readKey(SEEDS_KEY)) || "{}") }); } catch { /* start fresh */ }
    try { set({ saved: JSON.parse((await readKey(SAVED_KEY)) || "{}") }); } catch { /* start fresh */ }
    try { state = { ...state, last: JSON.parse((await readKey(LAST_KEY)) || "{}") }; listeners.forEach((l) => l()); } catch { /* start fresh */ }
    try { set({ verdictChoice: JSON.parse((await readKey(VERDICT_KEY)) || "{}") }); } catch { /* start fresh */ }
  }
  set({ billboardSeed: Math.floor(Math.random() * 1e9) }); // every refresh shows a different Billboard title
  const lovedAnime = fetchAniList("anime", { sort: "loved", perPage: 50 }).then((r) => r.items).catch(() => []);
  const cinema = loadCinemaPools().then((c) => { mergePools(c); return c; }).catch(() => ({}));
  await Promise.all([
    loadExplorePools({ extras: false }).then((pools) => mergePools(pools)).then(topUpPools).catch(() => mergePools({})),
    cinema.then(() => topUpPools()),
    loadComingBooks().then(mergePools).catch(() => {}),
    loadAwards().then((a) => set({ oscars: a.oscars, emmys: a.emmys })).catch(() => set({ oscars: state.oscars || [], emmys: state.emmys || [] })),
    loadAnimeOfTheYear().then((aoty) => set({ aoty })).catch(() => set({ aoty: state.aoty || [] })),
    // Best out there, Popular in town and Most loved from the community's verdicts (null with no server: they fall back or hide)
    loadCommunityRows().then((community) => set({ community })).catch(() => {}),
    // Most loved: the VoidPop community once it has enough verdicts, until then a mix of everything's most loved
    Promise.all([lovedAnime, cinema]).then(([la, c]) => loadMostLoved(la, c.topMv || [], c.topTv || []))
      .then((r) => set({ mostLoved: r.items, lovedFrom: r.from }))
      .catch(async () => set({ mostLoved: state.mostLoved || (await lovedAnime) })),
    loadTrend(state.country),
    refreshPersonal().then(() => (state.verdictSources ? buildVerdicts() : null)), // again, now that movies and TV are in the pools
  ]);
}

// New shows for one tile: a new order, and for most tiles a fresh page of shows from AniList to draw from.
// Not for Most loved and Trending: they are rankings.
export async function reroll(key) {
  if (state.busy[key]) return;
  set({ busy: { ...state.busy, [key]: true } });
  let more = null;
  const src = EXTRA[key];
  if (src) {
    try {
      const page = 1 + Math.floor(Math.random() * src.maxPage);
      more = await Promise.race([fetchMore(src, page), sleep(6000).then(() => { throw new Error("slow"); })]);
    } catch { /* offline or slow: reshuffle what we already have */ }
  }
  // Peak like / Dive in like / One time like: move to another of your titles, so the title changes too
  let verdicts = null; // set only for a verdict tile, so a slower Reroll of another tile never overwrites it
  let verdictChoice = null;
  if (VERDICTS.includes(key)) {
    const next = nextSource(state.verdictSources?.[key], state.verdicts?.[key]?.source);
    if (next) {
      let items = [];
      try { items = await Promise.race([recsFor(next), sleep(6000).then(() => { throw new Error("slow"); })]); } catch { /* keep the current picks */ items = null; }
      if (items) {
        verdicts = { ...state.verdicts, [key]: { source: next, items: mixed(next, items) } };
        verdictChoice = { ...state.verdictChoice, [key]: srcKey(next) };
        writeKey(VERDICT_KEY, JSON.stringify(verdictChoice)).catch(() => {});
      }
    }
  }
  const seed = 1 + Math.floor(Math.random() * 1e6);
  const seeds = { ...state.seeds, [key]: seed };
  const extra = more ? { ...state.extra, [key]: dedupe([...(state.extra[key] || []), ...more]).slice(0, 150) } : state.extra;
  let saved = state.saved;
  if (src) {
    // keep exactly what this Reroll picked, so the tile doesn't change again when the app restarts
    const picked = viewTile(key, { ...state, seeds, extra, saved: { ...state.saved, [key]: undefined } }).items || [];
    saved = { ...state.saved, [key]: picked };
    writeKey(SAVED_KEY, JSON.stringify(saved)).catch(() => {});
  }
  writeKey(SEEDS_KEY, JSON.stringify(seeds)).catch(() => {});
  set({ seeds, extra, saved, ...(verdicts ? { verdicts, verdictChoice } : {}), busy: { ...state.busy, [key]: false } });
}

// Pull to refresh: every tile that can be rerolled gets new shows (the fixed lists just reload)
export async function rerollAll() {
  await Promise.allSettled(TILES.filter((t) => t.reroll).map((t) => reroll(t.key)));
}

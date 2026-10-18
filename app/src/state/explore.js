// The Explore data, shared by the Explore grid and the category pages (a tiny
// store: both read it with useExplore(), the actions below change it).
// Loading is done here so a category page opens with what the grid already fetched.
import { useSyncExternalStore } from "react";
import { readKey, writeKey } from "@voidpop/shared/backend/storage";
import { fetchAniList } from "@voidpop/shared/api/anilist";
import { loadExplorePools, knownKeys, loadVerdictSources, loadRecsLike, loadNewSeasons, loadAnimeOfTheYear, loadJumpBackIn, loadInProgress } from "@voidpop/shared/features/explore";
import { TILES, EXTRA, PICK_COUNT, viewTile, dedupe, poolFor, chosenSource, nextSource } from "@voidpop/shared/features/exploreTiles";

const SEEDS_KEY = "voidation:explore:seeds:v1"; // { tileKey: seed }: the order each tile was last rerolled to
const SAVED_KEY = "voidation:explore:picks:v1"; // { tileKey: [shows] }: what a rerolled tile showed, kept so it stays put
const VERDICT_KEY = "voidation:explore:verdict:v1"; // { peak: "anime:123", … }: which of your titles each verdict tile is "like"
const LAST_KEY = "voidation:explore:last:v1"; // { tileKey: { title, subtitle, items } }: what every tile showed last time, so none is ever empty or blank

let state = {
  pools: null, known: new Set(), aoty: null, mostLoved: null, trend: null, country: "JP",
  verdicts: null, verdictSources: null, verdictChoice: {}, newSeasons: null, jump: null, jumpFallback: [],
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
async function buildVerdicts() {
  const sources = state.verdictSources || {};
  const out = {};
  await Promise.all(VERDICTS.map(async (v) => {
    const source = chosenSource(sources[v], state.verdictChoice[v]);
    let items = [];
    if (source) { try { items = await recsFor(source); } catch { /* offline: the tile tops itself up */ } }
    out[v] = { source, items };
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
    loadJumpBackIn().then((jump) => set({ jump })).catch(() => set({ jump: state.jump || { anime: [], manga: [] } })),
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
        const r = await fetchAniList(src.segment, { sort: src.sort, perPage: 25, page, ...(src.tag ? { tag: src.tag } : {}) });
        extra = dedupe([...extra, ...r.items]);
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
  await Promise.all([
    loadExplorePools({ extras: false }).then((pools) => set({ pools })).then(topUpPools).catch(() => set({ pools: state.pools || { trA: [], popA: [], popM: [], popN: [], coming: [] } })),
    loadAnimeOfTheYear().then((aoty) => set({ aoty })).catch(() => set({ aoty: state.aoty || [] })),
    fetchAniList("anime", { sort: "loved", perPage: 50 }).then((r) => set({ mostLoved: r.items })).catch(() => set({ mostLoved: state.mostLoved || [] })),
    loadTrend(state.country),
    refreshPersonal(),
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
      const r = await Promise.race([
        fetchAniList(src.segment, { sort: src.sort, perPage: 25, page, ...(src.tag ? { tag: src.tag } : {}) }),
        sleep(6000).then(() => { throw new Error("slow"); }),
      ]);
      more = r.items;
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
        verdicts = { ...state.verdicts, [key]: { source: next, items } };
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

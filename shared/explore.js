// Explore (home) sections — the same picks on the app and the website.
// Talk of the Week, Don't Miss This (Anime / Manga), Isekai Heaven, Shonen
// Feast, Voidation Angles (6 anime, 4 manga), and Anime of the Year. Picks are
// the same all day; pulling to refresh shuffles everything except Anime of the Year.

import { fetchAniList, fetchAnimeOfTheYear, fetchRecommendations, fetchSequels } from "./api/anilist.js";
import { readKey, writeKey } from "./backend/storage.js";
import { seasonOf, shiftSeason, seasonTitle } from "./season.js";
import { getReviews, getLibrary, getExcited, VERDICTS, leftToWatch } from "./backend/store.js";

const daySeed = () =>
  Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 864e5);

const rotate = (arr, by) =>
  arr.length ? [...arr.slice(by % arr.length), ...arr.slice(0, by % arr.length)] : [];

// Explore is for finding NEW things: anything already in your library (any
// status) or marked Excited is left out of the rows, except Talk of the Week. Pools are fetched larger
// than the rows so they stay full after that.
// shuffle: a pull-to-refresh asks for different pages, so the rows change.
// Without it (first load of the day) the picks are the same all day.
export async function loadExplorePools({ shuffle = false } = {}) {
  const page = (max) => (shuffle ? 1 + Math.floor(Math.random() * max) : 1);
  const get = (segment, sort, p, extra = {}) =>
    fetchAniList(segment, { sort, perPage: 25, page: p, ...extra }).then((r) => r.items).catch(() => []);
  // "Coming soon": this season and the next (Summer 2026 → Summer + Fall 2026;
  // Fall 2026 → Fall 2026 + Winter 2027), titles that haven't started yet
  const now = seasonOf();
  const next = shiftSeason(now, 1);
  const coming = (s) =>
    fetchAniList("anime", { season: s.season, year: s.year, unreleasedOnly: true, sort: "popular", perPage: 25 })
      .then((r) => r.items).catch(() => []);
  const popPage = page(4);
  const [trA, trM, popA1, popA2, popM1, popM2, comingNow, comingNext, isekai, shonen] = await Promise.all([
    get("anime", "trending", page(2)), get("manga", "trending", page(2)),
    get("anime", "popular", popPage), get("anime", "popular", popPage + 1),
    get("manga", "popular", popPage), get("manga", "popular", popPage + 1),
    coming(now), coming(next),
    get("anime", "popular", page(4), { tag: "Isekai" }),
    get("anime", "popular", page(6), { tag: "Shounen" }),
  ]);
  return {
    trA, trM, popA: [...popA1, ...popA2], popM: [...popM1, ...popM2],
    coming: [...comingNow, ...comingNext],
    comingTitle: "Coming soon",
    // shown as a pill next to the title, with the season's icon
    comingChip: { label: `${seasonTitle(now)} & ${seasonTitle(next)}`, icon: now.season },
    isekai, shonen,
  };
}

// Anime of the Year = the Crunchyroll Anime Awards winners (shared/awards.js).
// Fixed picks (they don't change on refresh), saved on the device and
// rechecked every few days for fresh posters.
const AOTY_KEY = "voidation:aoty:v2"; // v2: Crunchyroll Anime Awards winners
export async function loadAnimeOfTheYear() {
  const thisYear = new Date().getFullYear();
  let saved = null;
  try { saved = JSON.parse((await readKey(AOTY_KEY)) || "null"); } catch { saved = null; }
  if (saved && saved.items?.length && Date.now() - saved.at < 3 * 864e5 && saved.year === thisYear) return saved.items;
  try {
    const items = await fetchAnimeOfTheYear();
    if (items.length) await writeKey(AOTY_KEY, JSON.stringify({ at: Date.now(), year: thisYear, items }));
    return items;
  } catch {
    return saved?.items || [];
  }
}

export async function knownKeys() {
  const [lib, excited] = await Promise.all([getLibrary(), getExcited()]);
  return new Set([...Object.keys(lib), ...Object.keys(excited)]);
}

// seed: the day (same picks all day), or a random number after a refresh.
export function buildExplore(pools, known = new Set(), seed = daySeed()) {
  const fresh = (items) => items.filter((it) => !known.has(`${it.segment}:${it.id}`));
  const popA = fresh(pools.popA);
  const popM = fresh(pools.popM);
  const dontMissAnime = rotate(popA, seed).slice(0, 10);
  const dontMissManga = rotate(popM, seed).slice(0, 10);
  // Voidation picks never repeat what "Don't miss this" already shows
  const shown = new Set([...dontMissAnime, ...dontMissManga].map((it) => `${it.segment}:${it.id}`));
  // prefer titles no other row shows; if that leaves nothing, allow repeats
  const notShown = (items) => { const left = items.filter((it) => !shown.has(`${it.segment}:${it.id}`)); return left.length ? left : items; };
  // soonest premiere first; titles without a date yet go last, most popular first
  const seenComing = new Set();
  const coming = fresh(pools.coming || [])
    .filter((it) => !seenComing.has(it.id) && seenComing.add(it.id))
    .sort((a, b) => (a.date ? 0 : 1) - (b.date ? 0 : 1) || (a.date || "").localeCompare(b.date || ""))
    .slice(0, 20);
  // the Billboard at the top of Explore (Netflix-style): a trending anime with
  // a wide banner picture, different each day and on every refresh. Library
  // titles are allowed; the billboard just says they're on your list.
  const featuredPool = (pools.trA || []).filter((it) => it.banner && !it.unreleased).slice(0, 10);
  const featured = rotate(featuredPool, seed * 13)[0] || null;
  return {
    featured,
    coming,
    comingTitle: pools.comingTitle,
    comingChip: pools.comingChip,
    // Talk of the Week is what everyone's talking about, so it includes shows you've seen
    talk: [...pools.trA.slice(0, 7), ...pools.trM.slice(0, 5)],
    dontMissAnime,
    dontMissManga,
    isekai: rotate(fresh(pools.isekai || []), seed * 7).slice(0, 12),
    shonen: rotate(fresh(pools.shonen || []), seed * 11).slice(0, 12),
    voidpicks: [
      ...rotate(notShown(popA), seed * 3).slice(0, 6),
      ...rotate(notShown(popM), seed * 5).slice(0, 4),
    ],
  };
}

export async function loadExplore() {
  const [pools, known] = await Promise.all([loadExplorePools(), knownKeys()]);
  return buildExplore(pools, known);
}

// Rows built from your verdicts: "Peak like Attack on Titan", "Dive in like
// Death Note", "One time like …". Void It gets no row: it means you didn't
// like it, so "more like it" would be the wrong advice. Each row uses one of
// your titles with that verdict, rotating daily, and skips anything already in
// your library.
const ROW_TITLE = { peak: "Peak like", divein: "Dive in like", onetime: "One time like" };

export async function loadVerdictRows() {
  const [reviews, lib, excited] = await Promise.all([getReviews(), getLibrary(), getExcited()]);
  const known = new Set([...Object.keys(lib), ...Object.keys(excited)]);
  const seed = daySeed();
  const rows = [];
  for (const verdict of ["peak", "divein", "onetime"]) {
    const mine = reviews
      .filter((r) => r.verdict === verdict && lib[`${r.segment}:${r.titleId}`])
      .sort((a, b) => (b.date || "").localeCompare(a.date || ""));
    if (!mine.length) continue;
    const pick = mine[seed % mine.length];
    const source = lib[`${pick.segment}:${pick.titleId}`].item;
    try {
      const items = (await fetchRecommendations(pick.segment, pick.titleId))
        .filter((it) => !known.has(`${it.segment}:${it.id}`))
        .slice(0, 10);
      if (items.length) {
        rows.push({
          verdict, source, items,
          title: `${ROW_TITLE[verdict]} ${source.title}`,
          color: VERDICTS.find((v) => v.key === verdict)?.color,
        });
      }
    } catch { /* offline with nothing saved: skip the row */ }
  }
  return rows;
}

// "New seasons of shows you watched": sequels of anime you've completed or are
// watching that are airing now, announced, or came out in the last 12 months,
// and aren't in your library yet. Airing first, then announced, then recent.
//
// Each show's sequels are checked at most once a day and remembered on the
// device, so a big library doesn't flood AniList with requests.
const SEQ_KEY = "voidation:sequels:v1";
const SEQ_TTL = 24 * 3600 * 1000;
const YEAR_MS = 365 * 864e5;

export async function loadNewSeasons() {
  const [lib, excited] = await Promise.all([getLibrary(), getExcited()]);
  const known = new Set([...Object.keys(lib), ...Object.keys(excited)]);
  const sources = Object.values(lib)
    .filter((e) => e.item.segment === "anime" && (e.status === "completed" || e.status === "rewatching" || e.status === "watching"))
    .sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""))
    .slice(0, 150)
    .map((e) => e.item);

  let saved = {};
  try { saved = JSON.parse((await readKey(SEQ_KEY)) || "{}"); } catch { saved = {}; }
  const stale = sources.filter((s) => !saved[s.id] || Date.now() - saved[s.id].at > SEQ_TTL).map((s) => s.id);
  if (stale.length) {
    try {
      const fresh = await fetchSequels(stale);
      Object.entries(fresh).forEach(([id, items]) => { saved[id] = { at: Date.now(), items }; });
      await writeKey(SEQ_KEY, JSON.stringify(saved));
    } catch { /* offline or AniList busy: use what was saved */ }
  }

  const now = Date.now();
  const rank = (it) => (!it.unreleased && !it.finished ? 0 : it.unreleased ? 1 : 2);
  const isNew = (it) => it.unreleased || !it.finished || (it.date && now - new Date(it.date).getTime() < YEAR_MS);
  const candidates = [];
  const seen = new Set();
  sources.forEach((src) => {
    (saved[src.id]?.items || []).forEach((it) => {
      const key = `anime:${it.id}`;
      if (known.has(key) || seen.has(key) || !isNew(it)) return; // an old sequel isn't "new"
      seen.add(key);
      candidates.push({ ...it, sequelOf: src.title });
    });
  });

  // Already on Season 3? Then Season 2 isn't news. Follow each candidate's own
  // sequels (checked once a day, like the rest) and drop it if any later season
  // is already in your library.
  const unknown = candidates.filter((c) => !saved[c.id] || Date.now() - saved[c.id].at > SEQ_TTL).map((c) => c.id);
  if (unknown.length) {
    try {
      const fresh = await fetchSequels(unknown);
      Object.entries(fresh).forEach(([id, items]) => { saved[id] = { at: Date.now(), items }; });
      await writeKey(SEQ_KEY, JSON.stringify(saved));
    } catch { /* offline: judge by what's saved */ }
  }
  const laterSeasonKnown = (id, depth = 0, visited = new Set()) => {
    if (depth > 6 || visited.has(id)) return false;
    visited.add(id);
    return (saved[id]?.items || []).some((next) => known.has(`anime:${next.id}`) || laterSeasonKnown(next.id, depth + 1, visited));
  };
  const out = candidates.filter((c) => !laterSeasonKnown(c.id));
  return out
    .sort((a, b) => rank(a) - rank(b) || (b.date || "").localeCompare(a.date || ""))
    .slice(0, 20);
}

// "Jump back in": anime and manga you started and then left — Watching /
// Reading, Rewatching or On Hold, with progress, untouched for 3+ days, and
// with something left (a caught-up airing show isn't "left", it's waiting).
// Most recently left first. { anime: [...], manga: [...] }, up to 12 each.
export const JUMP_BACK_DAYS = 3;
export async function loadJumpBackIn(now = Date.now()) {
  const cutoff = new Date(now - JUMP_BACK_DAYS * 864e5).toISOString();
  const entries = Object.values(await getLibrary())
    .filter((e) => ["watching", "rewatching", "onhold"].includes(e.status) && (e.progress || 0) > 0)
    .filter((e) => (e.updatedAt || "") < cutoff)
    .filter((e) => { const left = leftToWatch(e); return left === null ? e.item.segment === "manga" : left > 0; })
    .sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
  const pick = (seg) => entries.filter((e) => e.item.segment === seg).slice(0, 12).map((e) => e.item);
  return { anime: pick("anime"), manga: pick("manga") };
}

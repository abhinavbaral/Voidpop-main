// Explore (home) sections — the same picks on the app and the website.
// Talk of the Week, Don't Miss This (Anime / Manga), and daily Voidation
// Recommendations (6 anime, 4 manga). Picks rotate deterministically each day,
// so both clients agree all day.

import { fetchAniList, fetchRecommendations } from "./api/anilist.js";
import { getReviews, getLibrary, getExcited, VERDICTS } from "./backend/store.js";

const daySeed = () =>
  Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 864e5);

const rotate = (arr, by) =>
  arr.length ? [...arr.slice(by % arr.length), ...arr.slice(0, by % arr.length)] : [];

// Explore is for finding NEW things: anything already in your library (any
// status) or marked Excited is left out of the rows, except Talk of the Week. Pools are fetched larger
// than the rows so they stay full after that.
export async function loadExplorePools() {
  const get = (segment, sort, page) =>
    fetchAniList(segment, { sort, perPage: 25, page }).then((r) => r.items).catch(() => []);
  const [trA, trM, popA1, popA2, popM1, popM2] = await Promise.all([
    get("anime", "trending", 1), get("manga", "trending", 1),
    get("anime", "popular", 1), get("anime", "popular", 2),
    get("manga", "popular", 1), get("manga", "popular", 2),
  ]);
  return { trA, trM, popA: [...popA1, ...popA2], popM: [...popM1, ...popM2] };
}

export async function knownKeys() {
  const [lib, excited] = await Promise.all([getLibrary(), getExcited()]);
  return new Set([...Object.keys(lib), ...Object.keys(excited)]);
}

export function buildExplore(pools, known = new Set()) {
  const seed = daySeed();
  const fresh = (items) => items.filter((it) => !known.has(`${it.segment}:${it.id}`));
  const popA = fresh(pools.popA);
  const popM = fresh(pools.popM);
  const dontMissAnime = rotate(popA, seed).slice(0, 10);
  const dontMissManga = rotate(popM, seed).slice(0, 10);
  // Voidation picks never repeat what "Don't miss this" already shows
  const shown = new Set([...dontMissAnime, ...dontMissManga].map((it) => `${it.segment}:${it.id}`));
  const notShown = (items) => items.filter((it) => !shown.has(`${it.segment}:${it.id}`));
  return {
    // Talk of the Week is what everyone's talking about, so it includes shows you've seen
    talk: [...pools.trA.slice(0, 7), ...pools.trM.slice(0, 5)],
    dontMissAnime,
    dontMissManga,
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

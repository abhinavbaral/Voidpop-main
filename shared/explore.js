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

export async function loadExplore() {
  const seed = daySeed();
  const [trA, trM, popA, popM] = await Promise.all([
    fetchAniList("anime", { sort: "trending", perPage: 15 }).catch(() => ({ items: [] })),
    fetchAniList("manga", { sort: "trending", perPage: 15 }).catch(() => ({ items: [] })),
    fetchAniList("anime", { sort: "popular", perPage: 25 }).catch(() => ({ items: [] })),
    fetchAniList("manga", { sort: "popular", perPage: 25 }).catch(() => ({ items: [] })),
  ]);

  return {
    talk: [...trA.items.slice(0, 7), ...trM.items.slice(0, 5)],
    dontMissAnime: rotate(popA.items, seed).slice(0, 10),
    dontMissManga: rotate(popM.items, seed).slice(0, 10),
    voidpicks: [
      ...rotate(popA.items, seed * 3).slice(0, 6),
      ...rotate(popM.items, seed * 5).slice(0, 4),
    ],
  };
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

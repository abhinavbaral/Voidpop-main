// Explore (home) sections — the same picks on the app and the website.
// Talk of the Week, Don't Miss This (Anime / Manga), and daily Voidation
// Recommendations (6 anime, 4 manga). Picks rotate deterministically each day,
// so both clients agree all day.

import { fetchAniList } from "./api/anilist.js";

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

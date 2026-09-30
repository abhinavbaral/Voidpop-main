// Season chart: every anime of one season (Winter = Jan–Mar, Spring = Apr–Jun,
// Summer = Jul–Sep, Fall = Oct–Dec, as AniList counts them), grouped by format.
import { fetchAniList } from "./api/anilist.js";

const ORDER = ["winter", "spring", "summer", "fall"];
export const SEASON_LABEL = { winter: "Winter", spring: "Spring", summer: "Summer", fall: "Fall" };

export function seasonOf(date = new Date()) {
  return { season: ORDER[Math.floor(date.getMonth() / 3)], year: date.getFullYear() };
}

export function shiftSeason({ season, year }, by) {
  const i = ORDER.indexOf(season) + by;
  return { season: ORDER[((i % 4) + 4) % 4], year: year + Math.floor(i / 4) };
}

export const seasonTitle = (s) => `${SEASON_LABEL[s.season]} ${s.year}`;

// the months a season covers: "October 2026 – December 2026"
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export function seasonMonths({ season, year }) {
  const first = ORDER.indexOf(season) * 3;
  return `${MONTH_NAMES[first]} ${year} – ${MONTH_NAMES[first + 2]} ${year}`;
}

export const FORMAT_GROUPS = [
  { key: "tv", label: "TV", formats: ["TV"] },
  { key: "short", label: "TV Short", formats: ["TV_SHORT"] },
  { key: "ona", label: "ONA", formats: ["ONA"] },
  { key: "movie", label: "Movies", formats: ["MOVIE"] },
  { key: "other", label: "OVA & Specials", formats: ["OVA", "SPECIAL", "MUSIC"] },
];
export const groupOf = (item) => FORMAT_GROUPS.find((g) => g.formats.includes(item.format))?.key || "tv";

// Loads the whole season, most popular first, page by page (AniList allows 25
// per request). onProgress(itemsSoFar) lets the screen fill in as pages arrive.
export async function fetchSeason({ season, year }, onProgress) {
  const all = [];
  const seen = new Set();
  for (let page = 1; page <= 8; page++) {
    const { items, hasMore } = await fetchAniList("anime", { season, year, sort: "popular", perPage: 25, page });
    items.forEach((it) => { if (!seen.has(it.id)) { seen.add(it.id); all.push(it); } });
    onProgress?.([...all]);
    if (!hasMore) break;
  }
  return all;
}

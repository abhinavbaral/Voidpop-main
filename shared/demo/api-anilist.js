// DEMO MODE stand-in for src/api/anilist.js — same exports, served from the
// local catalog. Constants are re-exported from the real module so the
// filters in the UI can never drift from production.
import { CATALOG, findItem, toAppItem } from "./catalog.js";
import { CRUNCHYROLL_AOTY } from "../awards.js";
import { readingLinks } from "../readLinks.js";
export { SORTS, SEASONS, GENRES, ANIME_ORIGINS, MANGA_ORIGINS } from "../api/anilist.js";
// the demo is always "online"; these keep the same exports as the real module
export const onNetState = (fn) => { fn({ offline: false, since: null }); return () => {}; };
export const cacheClear = async () => {};
export const cacheSize = async () => 0;
export const setDeviceOnline = () => {};

const wait = (ms = 250) => new Promise((r) => setTimeout(r, ms));
// AniList's seasons: Winter = Jan–Mar, Spring = Apr–Jun, Summer = Jul–Sep, Fall = Oct–Dec
const SEASON_OF_MONTH = (m) => ["winter", "spring", "summer", "fall"][Math.floor((m - 1) / 3)];

function sortItems(items, sort) {
  const byDate = (i) => new Date(i.date).getTime();
  const s = [...items];
  if (sort === "newest") s.sort((a, b) => byDate(b) - byDate(a));
  else if (sort === "oldest") s.sort((a, b) => byDate(a) - byDate(b));
  else if (sort === "trending") s.sort((a, b) => byDate(b) - byDate(a) || b.popularity - a.popularity);
  else s.sort((a, b) => b.popularity - a.popularity);
  return s;
}

export async function fetchAniList(segment, opts = {}) {
  const {
    page = 1, sort = "popular", search = "", origin = "",
    season = "", year = null, unreleasedOnly = false, perPage = 24, genre = "", tag = "",
  } = opts;
  await wait();
  let items = CATALOG[segment] || [];
  if (genre) items = items.filter((i) => i.genres.includes(genre));
  // the demo has no tags: Isekai → Fantasy/Adventure, Shounen → Action
  if (tag) items = items.filter((i) => i.genres.some((g) => ({ Isekai: ["Fantasy", "Adventure"], Shounen: ["Action"] }[tag] || [tag]).includes(g)));
  if (search) items = items.filter((i) => i.title.toLowerCase().includes(search.toLowerCase()));
  if (origin) items = items.filter((i) => i.country === origin);
  if (unreleasedOnly) items = items.filter((i) => i.unreleased);
  else if (!search) items = items.filter((i) => !i.unreleased || sort === "newest");
  if (segment === "anime" && season) {
    const y = year || new Date().getFullYear();
    const m = new Date().getMonth() + 1;
    const isNow = y === new Date().getFullYear() && SEASON_OF_MONTH(m) === season;
    items = items.filter((i) => {
      const [iy, im] = i.date.split("-").map(Number);
      // demo titles are older than they pretend: the airing ones count as this season
      return (iy === y && SEASON_OF_MONTH(im) === season) || (isNow && i.nextEpisode);
    });
  }
  items = sortItems(items, sort);
  const start = (page - 1) * perPage;
  return {
    items: items.slice(start, start + perPage).map(toAppItem),
    hasMore: start + perPage < items.length,
  };
}

export async function fetchAniListItem(segment, id) {
  await wait(150);
  const it = findItem(segment, id);
  return it ? toAppItem(it) : null;
}

export async function fetchAniListDetail(segment, id) {
  await wait(150);
  const it = findItem(segment, id);
  const related = (it?.related || [])
    .map((rid) => findItem(segment, rid))
    .filter(Boolean)
    .map((r) => ({
      relation: new Date(r.date) > new Date(it.date) ? "SEQUEL" : "PREQUEL",
      item: toAppItem(r),
    }));
  // sample services so the "Where to watch" section shows up in the demo
  const whereToWatch = segment === "anime"
    ? [
        { site: "Crunchyroll", url: "https://www.crunchyroll.com", color: "#F88A0E", languages: ["English", "Hindi"] },
        { site: "Netflix", url: "https://www.netflix.com", color: "#E50914", languages: [] },
      ]
    : [{ site: "MANGA Plus", url: "https://mangaplus.shueisha.co.jp", color: "#E0001B", languages: ["English"] }];
  // manga: sample AniList-style links (one reader marked INFO, as AniList sometimes does), or
  // none at all for every third title so the "search" fallback shows too
  const sample = [
    { site: "MANGA Plus", url: "https://mangaplus.shueisha.co.jp", type: "INFO", language: "English", color: "#E0001B" },
    { site: "K MANGA", url: "https://kmanga.kodansha.com", type: "STREAMING", language: "English", color: "#1A1A1A" },
    { site: "BookWalker", url: "https://global.bookwalker.jp", type: "INFO", language: "English", color: "#1E90C8" },
    { site: "Twitter", url: "https://twitter.com", type: "SOCIAL" },
  ];
  const whereToRead = segment === "manga" ? readingLinks(Number(id) % 3 ? sample : [], { title: it?.title, country: it?.country }) : null;
  return { trailer: null, related, whereToWatch, whereToRead }; // trailers can't be embedded in the demo
}

// Every episode airing in the next `days` days: each airing demo title gets its
// next episode plus the following weekly ones inside the window.
export async function fetchAiringSchedule(days = 7) {
  await wait();
  const end = Date.now() / 1000 + days * 86400;
  const out = [];
  CATALOG.anime.filter((a) => a.nextEpisode).forEach((a) => {
    for (let k = 0; ; k++) {
      const airingAt = a.nextEpisode.airingAt + k * 7 * 86400;
      const episode = a.nextEpisode.episode + k;
      if (airingAt > end || (a.episodes && episode > a.episodes)) break;
      out.push({ episode, airingAt, item: toAppItem(a) });
    }
  });
  return out.sort((x, y) => x.airingAt - y.airingAt);
}

export async function fetchNextEpisodes(ids) {
  await wait(150);
  const out = {};
  ids.forEach((id) => {
    const it = findItem("anime", id);
    if (it) out[it.id] = toAppItem(it);
  });
  return out;
}

export async function fetchRecentEpisodes(ids, days = 14) {
  await wait();
  const now = Date.now() / 1000;
  const out = [];
  ids.forEach((id) => {
    const a = findItem("anime", id);
    if (!a?.nextEpisode) return;
    for (let k = 1; ; k++) {
      const airingAt = a.nextEpisode.airingAt - k * 7 * 86400;
      const episode = a.nextEpisode.episode - k;
      if (episode < 1 || airingAt < now - days * 86400) break;
      if (airingAt < now) out.push({ episode, airingAt, item: toAppItem(a) });
    }
  });
  return out.sort((x, y) => y.airingAt - x.airingAt);
}

// Import from AniList (demo): pretends the user "demo" has these lists.
export async function fetchAniListUserList(userName) {
  await wait(600);
  if (userName.trim().toLowerCase() !== "demo") throw new Error(`No AniList user called "${userName.trim()}". In the demo, try "demo".`);
  const pickN = (seg, n, from) => CATALOG[seg].filter((i) => !i.unreleased).slice(from, from + n);
  const now = Math.floor(Date.now() / 1000);
  const statuses = ["COMPLETED", "CURRENT", "PLANNING", "PAUSED", "DROPPED"];
  return [
    ...pickN("anime", 10, 12).map((it, i) => ({ status: statuses[i % 5], progress: i % 5 === 1 ? 4 : 0, updatedAt: now - i * 3600, item: { ...toAppItem(it), partial: true } })),
    ...pickN("manga", 5, 8).map((it, i) => ({ status: statuses[i % 5], progress: i * 10, updatedAt: now - i * 3600, item: { ...toAppItem(it), partial: true } })),
  ];
}

// Recommendations (demo): other catalog titles sharing a genre with this one.
export async function fetchRecommendations(segment, id, perPage = 12) {
  await wait(200);
  const it = findItem(segment, id);
  if (!it) return [];
  return CATALOG[segment]
    .filter((x) => x.id !== it.id && !x.unreleased && x.genres.some((g) => it.genres.includes(g)))
    .sort((a, b) => b.popularity - a.popularity)
    .slice(0, perPage)
    .map(toAppItem);
}

// Signed-in AniList isn't available in the demo (no sign-in there).
export class AniListAuthError extends Error {}
export const fetchViewer = async () => { throw new Error("Not available in the demo."); };
export const saveListEntry = async () => { throw new Error("Not available in the demo."); };
export const deleteListEntry = async () => { throw new Error("Not available in the demo."); };

// Sequels (demo): catalog titles listed as related and released after this one.
export async function fetchSequels(ids) {
  await wait(200);
  const out = {};
  ids.forEach((id) => {
    const it = findItem("anime", id);
    out[id] = (it?.related || [])
      .map((rid) => findItem("anime", rid))
      .filter((r) => r && new Date(r.date) > new Date(it.date))
      .map(toAppItem);
  });
  return out;
}

// New announcements (demo): the catalog's upcoming titles, newest id first.
export async function fetchNewlyAnnounced() {
  await wait(200);
  return CATALOG.anime.filter((i) => i.unreleased).sort((a, b) => b.id - a.id).map(toAppItem);
}

// Earlier seasons (demo): related catalog titles released before this one.
export async function fetchEarlierSeasons(id) {
  await wait(150);
  const it = findItem("anime", id);
  return (it?.related || [])
    .map((rid) => findItem("anime", rid))
    .filter((r) => r && new Date(r.date) < new Date(it.date))
    .map(toAppItem);
}

// Anime of the Year (demo): the most popular finished catalog anime per year.
export async function fetchAnimeOfTheYear() {
  await wait(200);
  // the real winners that exist in the demo catalog
  const norm = (t) => t.toLowerCase().replace(/[^a-z0-9]/g, "");
  const used = new Set();
  return CRUNCHYROLL_AOTY.map((w) => {
    const hit = CATALOG.anime.find((i) => !used.has(i.id) && (norm(i.title) === norm(w.title) || norm(w.title).startsWith(norm(i.title))));
    if (hit) used.add(hit.id);
    return hit ? { ...toAppItem(hit), awardYear: w.year, award: "Crunchyroll Anime Awards" } : null;
  }).filter(Boolean);
}

// Premieres (demo): catalog anime starting in the range; the demo's upcoming
// titles are spread over the coming weeks so the calendar has something in it.
export async function fetchPremieres(from, to, { sort = "START_DATE" } = {}) {
  await wait(200);
  const num = (d) => Number(d.replaceAll("-", ""));
  const at = (days) => { const d = new Date(Date.now() + days * 864e5); return { date: d.toISOString().slice(0, 10), dateLabel: d.toDateString().slice(4) }; };
  let up = 0, air = 0;
  const items = CATALOG.anime.map((i) => {
    // upcoming titles: one every 3 days from tomorrow on
    if (i.unreleased) return { ...toAppItem(i), ...at(1 + 3 * up++) };
    // shows airing now: pretend they premiered over the last few weeks
    if (i.nextEpisode) return { ...toAppItem(i), ...at(-2 - 4 * air++) };
    return toAppItem(i);
  }).filter((i) => i.date && num(i.date) > from && num(i.date) < to);
  return items.sort((a, b) => (sort === "START_DATE_DESC" ? -1 : 1) * a.date.localeCompare(b.date));
}

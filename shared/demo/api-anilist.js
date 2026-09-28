// DEMO MODE stand-in for src/api/anilist.js — same exports, served from the
// local catalog. Constants are re-exported from the real module so the
// filters in the UI can never drift from production.
import { CATALOG, findItem, toAppItem } from "./catalog.js";
export { SORTS, SEASONS, ANIME_ORIGINS, MANGA_ORIGINS } from "../api/anilist.js";

const wait = (ms = 250) => new Promise((r) => setTimeout(r, ms));
const SEASON_OF_MONTH = (m) => ["winter", "spring", "summer", "fall"][Math.floor(((m % 12)) / 3)];

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
    season = "", year = null, unreleasedOnly = false, perPage = 24,
  } = opts;
  await wait();
  let items = CATALOG[segment] || [];
  if (search) items = items.filter((i) => i.title.toLowerCase().includes(search.toLowerCase()));
  if (origin) items = items.filter((i) => i.country === origin);
  if (unreleasedOnly) items = items.filter((i) => i.unreleased);
  else if (!search) items = items.filter((i) => !i.unreleased || sort === "newest");
  if (segment === "anime" && season) {
    const y = year || new Date().getFullYear();
    items = items.filter((i) => {
      const [iy, im] = i.date.split("-").map(Number);
      return iy === y && SEASON_OF_MONTH(im) === season;
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
  return { trailer: null, related, whereToWatch }; // trailers can't be embedded in the demo
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

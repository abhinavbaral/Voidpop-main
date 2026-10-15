// DEMO MODE stand-in for src/api/anilist.js — same exports, served from the
// local catalog. Constants are re-exported from the real module so the
// filters in the UI can never drift from production.
import { CATALOG, findItem, toAppItem } from "./catalog.js";
import { CRUNCHYROLL_AOTY } from "../features/awards.js";
import { readingLinks } from "../features/readLinks.js";
export { SORTS, SEASONS, GENRES, ANIME_ORIGINS, MANGA_ORIGINS, NOVEL_ORIGINS, labelOrder } from "../api/anilist.js";
import { labelOrder } from "../api/anilist.js";
// the demo is always "online"; these keep the same exports as the real module
export const onNetState = (fn) => { fn({ offline: false, since: null }); return () => {}; };
export const isDeviceOnline = () => true;
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
  else if (sort === "loved") s.sort((a, b) => (b.favourites ?? b.popularity ?? 0) - (a.favourites ?? a.popularity ?? 0));
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
  // the demo catalog has no novels; "manga" leaves them out like the real API
  let items = segment === "novel" ? (CATALOG.manga || []).filter((i) => i.format === "NOVEL")
    : segment === "manga" ? (CATALOG.manga || []).filter((i) => i.format !== "NOVEL") : CATALOG[segment] || [];
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
  // anime: its source, when the demo catalog has a manga of the same name
  let source = null;
  if (segment === "anime" && it) {
    const norm = (t) => t.toLowerCase().replace(/[^a-z0-9]/g, "");
    const m = CATALOG.manga.find((x) => norm(x.title) === norm(it.title) || norm(it.title).startsWith(norm(x.title)));
    source = m
      ? { label: m.country === "KR" ? "Manhwa" : m.country === "CN" ? "Manhua" : "Manga", items: [{ ...toAppItem(m), kindLabel: m.country === "KR" ? "Manhwa" : "Manga" }] }
      : { label: "Original", items: [] };
  }
  // sample cast so the Characters / Staff / Themes sections show in the demo
  const who = (name, n) => ({ id: n, name, native: null, image: it?.image || null });
  const characters = it ? ["Lead", "Rival", "Mentor", "Friend"].map((r, i) => ({
    ...who(`${r} (demo)`, 900 + i), role: i < 2 ? "Main" : "Supporting",
    voice: segment === "anime" ? who(`Voice actor ${i + 1}`, 950 + i) : null,
  })) : [];
  const staff = it ? [{ ...who(it.creator || "Demo Studio", 980), role: segment === "anime" ? "Director" : "Story & Art" }] : [];
  const themes = (it?.genres || []).map((g, i) => ({ name: g, rank: 90 - i * 5 }));
  const episodes = segment === "anime" && it ? Array.from({ length: 4 }, (_, i) => ({
    number: i + 1, name: `Demo episode ${i + 1}`, thumbnail: it.banner || it.image, url: "https://www.crunchyroll.com", site: "Crunchyroll",
  })) : [];
  // sample "Links" section: official site, socials, database pages
  const links = {
    official: [{ site: "Official Site", url: "https://example.com", color: null, language: "Japanese" }],
    social: [{ site: "Twitter", url: "https://x.com", color: "#1DA1F2", language: null }],
    databases: [
      { site: "AniList", url: `https://anilist.co/${segment}/${id}`, color: "#02a9ff", language: null },
      { site: "MyAnimeList", url: `https://myanimelist.net/${segment}`, color: "#2e51a2", language: null },
    ],
  };
  const whereToYouTube = segment === "anime" && it.id % 2 === 0 ? ["Muse Asia"] : [];
  return { trailer: null, related, whereToWatch, whereToYouTube, whereToRead, source, characters, staff, themes, episodes, links }; // trailers can't be embedded in the demo
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

// Welcome-screen cover wall (demo): covers of the sample catalog.
export async function fetchCoverPool(count = 15) {
  await wait(200);
  return CATALOG.anime.map(toAppItem).filter((i) => i.image).slice(0, count).map((i) => ({ id: i.id, uri: i.image, color: i.color || null }));
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

// Demo: pretend MAL ids equal the catalog's ids (true for many older titles).
export async function fetchByMalIds(segment, malIds) {
  await wait(150);
  const out = {};
  malIds.forEach((id) => { const it = findItem(segment, id); if (it) out[id] = toAppItem(it); });
  return out;
}

// Demo person page: a few roles from the catalog
export async function fetchPeople(search) {
  await wait(150);
  const q = String(search || "").toLowerCase();
  return ["Kana Hanazawa", "Yuki Kaji", "Hiroshi Kamiya", "Eiichiro Oda"].filter((n) => n.toLowerCase().includes(q))
    .map((name, i) => ({ id: 9000 + i, name, native: null, image: null, occupations: [i === 3 ? "Mangaka" : "Voice Actor"] }));
}

export async function fetchPerson(id) {
  await wait(150);
  const picks = CATALOG.anime.filter((x) => !x.unreleased).slice(0, 6);
  return {
    id, name: `Demo person ${id}`, native: null, image: picks[0]?.image || null,
    occupations: ["Voice Actor"], language: "Japanese",
    roles: picks.map((x, i) => ({ character: { id: 5000 + i, name: `Character ${i + 1}`, image: x.image }, role: i % 2 ? "Supporting" : "Main", item: toAppItem(x) })),
    work: [],
  };
}

// Demo watch order: this title plus its demo relations, by date
export async function fetchWatchOrder(id) {
  await wait(150);
  const it = findItem("anime", id);
  if (!it) return [];
  const all = [it, ...(it.related || []).map((r) => findItem("anime", r)).filter(Boolean)];
  return labelOrder(all.map(toAppItem).sort((a, b) => (a.date || "").localeCompare(b.date || "")));
}
export async function fetchDiscussions(id) {
  await wait(150);
  const it = findItem("anime", id) || findItem("manga", id);
  if (!it) return [];
  return [3, 2, 1].map((n) => ({ id: n, title: `${it.title} Episode ${n} Discussion`, replies: 40 * n, views: 900 * n, url: it.url || "https://anilist.co", at: 0 }));
}

// Statistics → "Your people": the demo only knows each title's studio or mangaka.
export async function fetchKinds() { return {}; }

export async function fetchCredits(ids) {
  await wait(150);
  const out = {};
  ids.forEach((id) => {
    const anime = findItem("anime", id);
    const it = anime || findItem("manga", id);
    if (!it) return;
    const who = toAppItem(it).creator;
    const pid = who ? [...who].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) | 0, 7) : 0;
    out[it.id] = !anime
      ? { studios: [], staff: who ? [{ id: pid, name: who, image: null, role: "Story & Art" }] : [], voices: [] }
      : { studios: who ? [{ id: pid, name: who }] : [], staff: [], voices: [] };
  });
  return out;
}

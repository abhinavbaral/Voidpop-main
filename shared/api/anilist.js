// AniList GraphQL — anime + manga. Free, NO KEY.
// Supports: countryOfOrigin toggles, seasons, trending, airing schedule,
// upcoming (unreleased) titles, and per-title details (trailer + related seasons).

import { CRUNCHYROLL_AOTY } from "../awards.js";
import { readingLinks } from "../readLinks.js";
import { formatDateParts } from "../format.js";
import { cacheKey, cacheGet, cachePut, isDeviceOnline, noteSavedShown } from "./cache.js";
export { onNetState, cacheClear, cacheSize, setDeviceOnline } from "./cache.js";

const URL = "https://graphql.anilist.co";

export const SORTS = [
  { key: "popular", label: "Popular" },
  { key: "trending", label: "Trending" },
  { key: "newest", label: "Newest" },
  { key: "oldest", label: "Oldest" },
];

const sortMap = {
  popular: "POPULARITY_DESC",
  trending: "TRENDING_DESC",
  newest: "START_DATE_DESC",
  oldest: "START_DATE",
};

export const SEASONS = ["winter", "spring", "summer", "fall"];

// AniList's genre list (its adult genre left out)
export const GENRES = [
  "Action", "Adventure", "Comedy", "Drama", "Ecchi", "Fantasy", "Horror", "Mahou Shoujo", "Mecha", "Music",
  "Mystery", "Psychological", "Romance", "Sci-Fi", "Slice of Life", "Sports", "Supernatural", "Thriller",
];

export const ANIME_ORIGINS = [
  { key: "", label: "All" },
  { key: "JP", label: "Japanese Anime" },
  { key: "KR", label: "Korean Animation" },
  { key: "CN", label: "Chinese Donghua" },
];

export const MANGA_ORIGINS = [
  { key: "", label: "All" },
  { key: "JP", label: "Japanese Manga" },
  { key: "KR", label: "Korean Manhwa" },
  { key: "CN", label: "Chinese Manhua" },
  { key: "US", label: "Comics" },
];

const stripHtml = (s) => (s || "").replace(/<[^>]+>/g, "").trim();

const MEDIA_FIELDS = `
  id
  title { english romaji }
  coverImage { large extraLarge }
  bannerImage
  startDate { year month day }
  genres
  description(asHtml: false)
  siteUrl
  status
  format
  duration
`;

// Creator line: animation studio for anime, mangaka for manga. Requested only
// for the matching type to keep AniList's query-complexity score down.
const CREATOR_FIELDS = {
  anime: `studios(isMain: true) { nodes { name } } episodes nextAiringEpisode { episode airingAt }`,
  manga: `staff(perPage: 6, sort: [RELEVANCE]) { edges { role node { name { full } } } } chapters`,
};
const fieldsFor = (segment) => `${MEDIA_FIELDS} ${CREATOR_FIELDS[segment] || ""}`;

// "Story & Art" → one mangaka; separate "Story" + "Art" → "Chugong & DUBU".
function mangakaOf(m) {
  const edges = m.staff?.edges || [];
  const pick = (re) => edges.filter((e) => re.test(e.role || "")).map((e) => e.node?.name?.full).filter(Boolean);
  const both = pick(/^(original )?(story ?& ?art|creator)/i);
  if (both.length) return both[0];
  const names = [...new Set([...pick(/^(original )?story/i).slice(0, 1), ...pick(/^art/i).slice(0, 1)])];
  return names.length ? names.join(" & ") : null;
}

const pad = (n) => String(n).padStart(2, "0");

function normalize(m, segment) {
  const d = m.startDate;
  return {
    id: m.id,
    segment,
    title: m.title.english || m.title.romaji,
    // the Japanese (romaji) title, when it's different: "Re:Zero kara Hajimeru Isekai Seikatsu"
    altTitle: m.title.english && m.title.romaji && m.title.romaji !== m.title.english ? m.title.romaji : null,
    image: m.coverImage?.extraLarge || m.coverImage?.large,
    banner: m.bannerImage || null,
    // zero-pad: "2013-4-7" is not ISO, so new Date() returns Invalid Date
    // (shows up as "NaN" years) — "2013-04-07" parses everywhere.
    date: d && d.year ? `${d.year}-${pad(d.month || 1)}-${pad(d.day || 1)}` : null,
    dateLabel: formatDateParts(d?.year, d?.month, d?.day),
    creator: segment === "manga" ? mangakaOf(m) : m.studios?.nodes?.[0]?.name || null,
    genres: m.genres || [],
    genre: m.genres?.[0] || (segment === "anime" ? "Anime" : "Manga"),
    overview: stripHtml(m.description),
    url: m.siteUrl,
    unreleased: m.status === "NOT_YET_RELEASED",
    finished: m.status === "FINISHED",
    format: m.format || null, // TV, TV_SHORT, ONA, MOVIE, OVA, SPECIAL…
    duration: m.duration ?? null, // minutes per episode (anime)
    // anime only: total episodes (null while unknown) and the next one to air
    episodes: m.episodes ?? null,
    // manga only: total chapters (null while still publishing)
    chapters: m.chapters ?? null,
    nextEpisode: m.nextAiringEpisode
      ? { episode: m.nextAiringEpisode.episode, airingAt: m.nextAiringEpisode.airingAt }
      : null,
  };
}

// How every AniList request is made:
//  1. An answer saved in the last few minutes is reused (AniList allows only
//     ~30–90 requests a minute, and several screens ask the same things).
//  2. The same request already on its way is shared, not sent twice.
//  3. Offline (the device says so): saved answer straight away, no waiting.
//  4. "Too many requests": wait as long as AniList asks (up to 15 s), try once more.
//  5. Still failing: the last saved answer, quietly. Only a real lack of
//     internet shows the Offline banner (see cache.js).
// AniList's own errors (user not found, private list…) are real answers and
// are passed through, not replaced by old data.
const FRESH_MS = 3 * 60 * 1000;
const inflight = new Map();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function gql(query, variables, { save = true, token = null } = {}) {
  const body = JSON.stringify({ query, variables });
  // signed-in requests (your own lists, changes) are never cached or shared
  if (token) return request(body, null, false, token);
  const k = cacheKey(body);
  if (save) {
    const saved = await cacheGet(k);
    if (saved && (Date.now() - saved.at < FRESH_MS || !isDeviceOnline())) {
      noteSavedShown(saved.at);
      return saved.data;
    }
  }
  if (!isDeviceOnline()) throw new Error("You're offline, and this hasn't been saved yet.");
  if (inflight.has(k)) return inflight.get(k);
  const p = request(body, k, save).finally(() => inflight.delete(k));
  inflight.set(k, p);
  return p;
}

async function post(body, token) {
  const ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timer = ctrl && setTimeout(() => ctrl.abort(), 15000);
  try {
    return await fetch(URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body,
      signal: ctrl?.signal,
    });
  } finally {
    if (timer) clearTimeout(timer);
  }
}

// thrown when AniList rejects the sign-in (expired or revoked)
export class AniListAuthError extends Error {}

async function request(body, k, save, token = null) {
  let json;
  try {
    let res = await post(body, token);
    if (res.status === 429) {
      const wait = Math.min(Number(res.headers?.get?.("Retry-After")) || 5, 15);
      await sleep(wait * 1000);
      res = await post(body, token);
    }
    if (res.status === 401) throw new AniListAuthError("Your AniList sign-in has expired. Sign in again.");
    if (res.status >= 500 || res.status === 429) throw new Error(`AniList is busy (${res.status}). Try again in a minute.`);
    json = await res.json();
  } catch (err) {
    if (err instanceof AniListAuthError) throw err;
    const saved = save ? await cacheGet(k) : null;
    if (saved) {
      noteSavedShown(saved.at);
      return saved.data;
    }
    throw err;
  }
  if (json.errors) {
    const msg = json.errors[0].message || "AniList error";
    if (token && /invalid token|unauthori[sz]ed|expired/i.test(msg)) throw new AniListAuthError("Your AniList sign-in has expired. Sign in again.");
    throw new Error(msg);
  }
  if (save) cachePut(k, json.data);
  return json.data;
}

// Browse/search list. opts: { page, sort, search, origin, season, year, unreleasedOnly }
export async function fetchAniList(segment, opts = {}) {
  const {
    page = 1, sort = "popular", search = "", origin = "",
    season = "", year = null, unreleasedOnly = false, perPage = 24, genre = "", tag = "",
  } = opts;

  const args = ["type: $type", "isAdult: false", "sort: $sort"];
  const varDefs = ["$page: Int", "$perPage: Int", "$type: MediaType", "$sort: [MediaSort]"];
  const variables = {
    page, perPage,
    type: segment === "anime" ? "ANIME" : "MANGA",
    sort: [search ? "SEARCH_MATCH" : sortMap[sort] || "POPULARITY_DESC"],
  };

  if (search) { varDefs.push("$search: String"); args.push("search: $search"); variables.search = search; }
  if (origin) { varDefs.push("$country: CountryCode"); args.push("countryOfOrigin: $country"); variables.country = origin; }
  if (unreleasedOnly) { args.push("status: NOT_YET_RELEASED"); }
  if (genre) { varDefs.push("$genre: String"); args.push("genre: $genre"); variables.genre = genre; }
  if (tag) { varDefs.push("$tag: String"); args.push("tag: $tag"); variables.tag = tag; }
  if (segment === "anime" && season) {
    varDefs.push("$season: MediaSeason", "$seasonYear: Int");
    args.push("season: $season", "seasonYear: $seasonYear");
    variables.season = season.toUpperCase();
    variables.seasonYear = year || new Date().getFullYear();
  }

  const query = `query (${varDefs.join(", ")}) {
    Page(page: $page, perPage: $perPage) {
      pageInfo { hasNextPage }
      media(${args.join(", ")}) { ${fieldsFor(segment)} }
    }
  }`;

  const data = await gql(query, variables);
  return {
    items: data.Page.media.map((m) => normalize(m, segment)),
    hasMore: data.Page.pageInfo.hasNextPage,
  };
}

// Your AniList lists, by username. Public lists need no key or login.
// Returns [{ status, progress, updatedAt, item }] for anime and manga.
// Light fields only (a big list can be 1,000+ titles); a title's synopsis and
// creator load the first time its page is opened (item.partial).
const LIST_FIELDS = `
  id title { english romaji } coverImage { large extraLarge } bannerImage
  startDate { year month day } genres siteUrl status format duration
  episodes chapters nextAiringEpisode { episode airingAt }
`;
// Pass a username (public lists), or { userId, token } when signed in (then
// private lists work too, and each entry's AniList list id comes back for sync).
export async function fetchAniListUserList(who) {
  const byName = typeof who === "string";
  const userName = byName ? who : "";
  const query = `query (${byName ? "$user: String" : "$userId: Int"}, $type: MediaType, $chunk: Int) {
    MediaListCollection(${byName ? "userName: $user" : "userId: $userId"}, type: $type, chunk: $chunk, perChunk: 500) {
      hasNextChunk
      lists { isCustomList entries { id status progress updatedAt media { ${LIST_FIELDS} } } }
    }
  }`;
  const out = [];
  for (const segment of ["anime", "manga"]) {
    for (let chunk = 1; chunk <= 20; chunk++) {
      let data;
      try {
        const type = segment === "anime" ? "ANIME" : "MANGA";
        data = byName
          ? await gql(query, { user: userName.trim(), type, chunk }, { save: false })
          : await gql(query, { userId: who.userId, type, chunk }, { token: who.token });
      } catch (e) {
        if (e instanceof AniListAuthError) throw e;
        const msg = String(e.message || "");
        if (/not found/i.test(msg)) throw new Error(`No AniList user called "${userName.trim()}".`);
        if (/private/i.test(msg)) throw new Error("That AniList profile is private. Make your lists public in AniList settings, import, then switch it back.");
        throw new Error("Couldn't reach AniList. Check your connection and try again.");
      }
      const col = data.MediaListCollection;
      // custom lists repeat titles that are already in the status lists
      col.lists.filter((l) => !l.isCustomList).forEach((l) =>
        l.entries.forEach((en) => out.push({
          listId: en.id, status: en.status, progress: en.progress, updatedAt: en.updatedAt,
          item: { ...normalize(en.media, segment), partial: true },
        }))
      );
      if (!col.hasNextChunk) break;
    }
  }
  return out;
}

/* ---------- signed-in AniList (sync) ---------- */

export async function fetchViewer(token) {
  const data = await gql(`query { Viewer { id name avatar { medium } } }`, {}, { token });
  return { id: data.Viewer.id, name: data.Viewer.name, avatar: data.Viewer.avatar?.medium || null };
}

// Create or update your AniList entry. Returns its list id.
export async function saveListEntry(token, mediaId, status, progress) {
  const data = await gql(
    `mutation ($mediaId: Int, $status: MediaListStatus, $progress: Int) {
      SaveMediaListEntry(mediaId: $mediaId, status: $status, progress: $progress) { id }
    }`,
    { mediaId: Number(mediaId), status, progress },
    { token }
  );
  return data.SaveMediaListEntry.id;
}

// Remove from your AniList list. listId unknown? It's looked up first.
export async function deleteListEntry(token, { listId, userId, mediaId }) {
  let id = listId;
  if (!id) {
    try {
      const data = await gql(`query ($u: Int, $m: Int) { MediaList(userId: $u, mediaId: $m) { id } }`,
        { u: userId, m: Number(mediaId) }, { token });
      id = data.MediaList?.id;
    } catch (e) {
      if (e instanceof AniListAuthError) throw e;
      if (/not found/i.test(e.message)) return; // not on AniList: nothing to delete
      throw e;
    }
  }
  if (!id) return;
  await gql(`mutation ($id: Int) { DeleteMediaListEntry(id: $id) { deleted } }`, { id }, { token });
}

// Newest anime added to AniList that haven't started yet = new announcements.
// (AniList gives each new title the next id, so highest id = most recent.)
export async function fetchNewlyAnnounced(perPage = 50) {
  const query = `query ($perPage: Int) {
    Page(perPage: $perPage) {
      media(type: ANIME, status: NOT_YET_RELEASED, isAdult: false, sort: [ID_DESC]) { ${fieldsFor("anime")} }
    }
  }`;
  const data = await gql(query, { perPage });
  return data.Page.media.map((m) => normalize(m, "anime"));
}

// Earlier seasons of an anime: follows AniList's PREQUEL links back
// (S3 → S2 → S1). Only TV / TV short / ONA seasons are returned; movies and
// specials in between are walked through but not returned.
const SEASON_FORMATS = new Set(["TV", "TV_SHORT", "ONA"]);
export async function fetchEarlierSeasons(id) {
  const query = `query ($id: Int) {
    Media(id: $id, type: ANIME) {
      relations { edges { relationType node { type ${LIST_FIELDS} studios(isMain: true) { nodes { name } } } } }
    }
  }`;
  const out = [];
  const seen = new Set([Number(id)]);
  let frontier = [Number(id)];
  for (let depth = 0; depth < 8 && frontier.length; depth++) {
    const nextFrontier = [];
    for (const mid of frontier) {
      const data = await gql(query, { id: mid });
      (data.Media?.relations?.edges || [])
        .filter((e) => e.relationType === "PREQUEL" && e.node.type === "ANIME" && !seen.has(e.node.id))
        .forEach((e) => {
          seen.add(e.node.id);
          nextFrontier.push(e.node.id);
          if (SEASON_FORMATS.has(e.node.format)) out.push({ ...normalize(e.node, "anime"), partial: true });
        });
    }
    frontier = nextFrontier;
  }
  return out;
}

// Anime of the Year: the best-rated anime of each year (among ones enough
// people watched), all years in ONE request using GraphQL aliases.
export async function fetchAnimeOfTheYear() {
  const light = `${LIST_FIELDS} studios(isMain: true) { nodes { name } } averageScore`;
  const pick = (w, m) => (m ? { ...normalize(m, "anime"), partial: true, awardYear: w.year, award: "Crunchyroll Anime Awards" } : null);
  const one = async (w) => {
    const q = w.id
      ? `query { Media(id: ${Number(w.id)}, type: ANIME) { ${light} } }`
      : `query ($s: String) { Media(search: $s, type: ANIME) { ${light} } }`;
    try { return pick(w, (await gql(q, w.id ? {} : { s: w.search })).Media); } catch { return null; }
  };
  const byId = CRUNCHYROLL_AOTY.filter((w) => w.id);
  let found = {};
  try {
    // one request for all the known ids
    const data = await gql(`query { ${byId.map((w) => `a${w.year}: Media(id: ${Number(w.id)}, type: ANIME) { ${light} }`).join(" ")} }`, {});
    byId.forEach((w) => { found[w.year] = pick(w, data[`a${w.year}`]); });
  } catch { found = {}; } // one bad id fails the whole request: fall back to one by one
  const out = await Promise.all(CRUNCHYROLL_AOTY.map((w) => found[w.year] || one(w)));
  return out.filter(Boolean);
}

// Anime starting between two dates (YYYYMMDD numbers), for the Upcoming calendar
// and "Latest premieres". sort: START_DATE or START_DATE_DESC.
export async function fetchPremieres(from, to, { sort = "START_DATE", status = null, pages = 3 } = {}) {
  const query = `query ($page: Int, $from: FuzzyDateInt, $to: FuzzyDateInt, $sort: [MediaSort]${status ? ", $status: MediaStatus" : ""}) {
    Page(page: $page, perPage: 25) {
      pageInfo { hasNextPage }
      media(type: ANIME, isAdult: false, startDate_greater: $from, startDate_lesser: $to, sort: $sort${status ? ", status: $status" : ""}) { ${fieldsFor("anime")} }
    }
  }`;
  const out = [];
  for (let page = 1; page <= pages; page++) {
    const data = await gql(query, { page, from, to, sort: [sort], ...(status ? { status } : {}) });
    out.push(...data.Page.media.map((m) => normalize(m, "anime")));
    if (!data.Page.pageInfo.hasNextPage) break;
  }
  return out;
}

// Sequels (next seasons) of many anime at once: { id -> [sequel items] }.
// Light fields for the sequels (no synopsis): their page fills in when opened.
export async function fetchSequels(ids) {
  const query = `query ($ids: [Int]) {
    Page(perPage: 10) {
      media(id_in: $ids, type: ANIME) {
        id
        relations { edges { relationType node { type ${LIST_FIELDS} studios(isMain: true) { nodes { name } } } } }
      }
    }
  }`;
  const out = {};
  for (let i = 0; i < ids.length; i += 10) {
    const data = await gql(query, { ids: ids.slice(i, i + 10).map(Number) });
    data.Page.media.forEach((m) => {
      out[m.id] = (m.relations?.edges || [])
        .filter((e) => e.relationType === "SEQUEL" && e.node.type === "ANIME")
        .map((e) => ({ ...normalize(e.node, "anime"), partial: true }));
    });
    ids.slice(i, i + 10).forEach((id) => { if (!out[id]) out[id] = []; });
  }
  return out;
}

// "If you liked this": AniList's community recommendations for one title,
// best-rated first. Free, no key.
export async function fetchRecommendations(segment, id, perPage = 12) {
  const query = `query ($id: Int, $type: MediaType, $perPage: Int) {
    Media(id: $id, type: $type) {
      recommendations(sort: [RATING_DESC], perPage: $perPage) {
        nodes { mediaRecommendation { ${fieldsFor(segment)} } }
      }
    }
  }`;
  const data = await gql(query, { id: Number(id), type: segment === "anime" ? "ANIME" : "MANGA", perPage });
  return (data.Media?.recommendations?.nodes || [])
    .map((n) => n.mediaRecommendation)
    .filter(Boolean)
    .map((m) => normalize(m, segment));
}

// One title by id — used when a Detail page is opened from a URL.
export async function fetchAniListItem(segment, id) {
  const query = `query ($id: Int, $type: MediaType) {
    Media(id: $id, type: $type) { ${fieldsFor(segment)} }
  }`;
  const data = await gql(query, {
    id: Number(id), type: segment === "anime" ? "ANIME" : "MANGA",
  });
  return data.Media ? normalize(data.Media, segment) : null;
}

// Detail: trailer, where to watch/read, related entries (sequels/prequels = other seasons)
export async function fetchAniListDetail(segment, id) {
  const query = `query ($id: Int, $type: MediaType) {
    Media(id: $id, type: $type) {
      trailer { id site }
      countryOfOrigin
      title { english romaji }
      externalLinks { site url type language color isDisabled }
      relations {
        edges {
          relationType
          node { type ${fieldsFor(segment)} }
        }
      }
    }
  }`;
  const data = await gql(query, {
    id: Number(id), type: segment === "anime" ? "ANIME" : "MANGA",
  });

  const trailer =
    data.Media.trailer?.site === "youtube" ? data.Media.trailer.id : null;

  const wanted = ["SEQUEL", "PREQUEL", "SIDE_STORY", "ALTERNATIVE", "PARENT"];
  const related = (data.Media.relations?.edges || [])
    .filter(
      (e) =>
        wanted.includes(e.relationType) &&
        e.node.type === (segment === "anime" ? "ANIME" : "MANGA")
    )
    .map((e) => ({
      relation: e.relationType,
      item: normalize(e.node, segment),
    }));

  const m = data.Media;
  return {
    trailer, related,
    whereToWatch: watchLinks(m.externalLinks),
    // manga: official readers, stores, or search boxes (shared/readLinks.js)
    whereToRead: segment === "manga" ? readingLinks(m.externalLinks, { title: m.title?.english || m.title?.romaji, country: m.countryOfOrigin }) : null,
  };
}

// Official streaming / reading services from AniList's external links.
// AniList lists them per language ("Crunchyroll · English"); one entry per
// service is enough, with its languages merged.
export function watchLinks(links) {
  const bySite = new Map();
  (links || [])
    .filter((l) => l.type === "STREAMING" && !l.isDisabled && l.url)
    .forEach((l) => {
      const cur = bySite.get(l.site);
      if (cur) {
        if (l.language && !cur.languages.includes(l.language)) cur.languages.push(l.language);
      } else {
        bySite.set(l.site, { site: l.site, url: l.url, color: l.color || null, languages: l.language ? [l.language] : [] });
      }
    });
  return [...bySite.values()];
}

// Every episode airing in the next `days` days, soonest first (Schedule page).
export async function fetchAiringSchedule(days = 7) {
  const start = Math.floor(Date.now() / 1000);
  const end = start + days * 86400;
  const query = `query ($page: Int, $start: Int, $end: Int) {
    Page(page: $page, perPage: 25) {
      pageInfo { hasNextPage }
      airingSchedules(airingAt_greater: $start, airingAt_lesser: $end, sort: TIME) {
        episode
        airingAt
        media { ${fieldsFor("anime")} isAdult }
      }
    }
  }`;
  // 25 per page keeps each query under AniList's complexity limit (the old
  // "airing today" query used the same size); six pages cover a busy week.
  const out = [];
  for (let page = 1; page <= 6; page++) {
    const data = await gql(query, { page, start, end });
    out.push(...data.Page.airingSchedules);
    if (!data.Page.pageInfo.hasNextPage) break;
  }
  return out
    .filter((s) => !s.media.isAdult)
    .map((s) => ({ episode: s.episode, airingAt: s.airingAt, item: normalize(s.media, "anime") }));
}

// Fresh "next episode" info for specific anime (the ones in your library).
// Library entries are snapshots, so their countdowns go stale; this refreshes them.
export async function fetchNextEpisodes(ids) {
  if (!ids.length) return {};
  const query = `query ($ids: [Int]) {
    Page(page: 1, perPage: 25) {
      media(id_in: $ids, type: ANIME) { ${fieldsFor("anime")} }
    }
  }`;
  const out = {};
  for (let i = 0; i < ids.length; i += 25) {
    const data = await gql(query, { ids: ids.slice(i, i + 25).map(Number) });
    data.Page.media.forEach((m) => { out[m.id] = normalize(m, "anime"); });
  }
  return out;
}

// Episodes that have ALREADY aired for specific anime in the last `days` days,
// newest first (History page: what dropped for the shows you follow).
export async function fetchRecentEpisodes(ids, days = 14) {
  if (!ids.length) return [];
  const end = Math.floor(Date.now() / 1000);
  const start = end - days * 86400;
  const query = `query ($page: Int, $ids: [Int], $start: Int, $end: Int) {
    Page(page: $page, perPage: 25) {
      pageInfo { hasNextPage }
      airingSchedules(mediaId_in: $ids, airingAt_greater: $start, airingAt_lesser: $end, sort: TIME_DESC) {
        episode
        airingAt
        media { ${fieldsFor("anime")} }
      }
    }
  }`;
  const out = [];
  for (let page = 1; page <= 4; page++) {
    const data = await gql(query, { page, ids: ids.map(Number), start, end });
    out.push(...data.Page.airingSchedules);
    if (!data.Page.pageInfo.hasNextPage) break;
  }
  return out.map((s) => ({ episode: s.episode, airingAt: s.airingAt, item: normalize(s.media, "anime") }));
}

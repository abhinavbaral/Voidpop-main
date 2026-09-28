// AniList GraphQL — anime + manga. Free, NO KEY.
// Supports: countryOfOrigin toggles, seasons, trending, airing schedule,
// upcoming (unreleased) titles, and per-title details (trailer + related seasons).

import { formatDateParts } from "../format.js";

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
    // anime only: total episodes (null while unknown) and the next one to air
    episodes: m.episodes ?? null,
    // manga only: total chapters (null while still publishing)
    chapters: m.chapters ?? null,
    nextEpisode: m.nextAiringEpisode
      ? { episode: m.nextAiringEpisode.episode, airingAt: m.nextAiringEpisode.airingAt }
      : null,
  };
}

async function gql(query, variables) {
  const res = await fetch(URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors) throw new Error(json.errors[0].message);
  return json.data;
}

// Browse/search list. opts: { page, sort, search, origin, season, year, unreleasedOnly }
export async function fetchAniList(segment, opts = {}) {
  const {
    page = 1, sort = "popular", search = "", origin = "",
    season = "", year = null, unreleasedOnly = false, perPage = 24,
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
  startDate { year month day } genres siteUrl status
  episodes chapters nextAiringEpisode { episode airingAt }
`;
export async function fetchAniListUserList(userName) {
  const query = `query ($user: String, $type: MediaType, $chunk: Int) {
    MediaListCollection(userName: $user, type: $type, chunk: $chunk, perChunk: 500) {
      hasNextChunk
      lists { isCustomList entries { status progress updatedAt media { ${LIST_FIELDS} } } }
    }
  }`;
  const out = [];
  for (const segment of ["anime", "manga"]) {
    for (let chunk = 1; chunk <= 20; chunk++) {
      let data;
      try {
        data = await gql(query, { user: userName.trim(), type: segment === "anime" ? "ANIME" : "MANGA", chunk });
      } catch (e) {
        const msg = String(e.message || "");
        if (/not found/i.test(msg)) throw new Error(`No AniList user called "${userName.trim()}".`);
        if (/private/i.test(msg)) throw new Error("That AniList profile is private. Make your lists public in AniList settings, import, then switch it back.");
        throw new Error("Couldn't reach AniList. Check your connection and try again.");
      }
      const col = data.MediaListCollection;
      // custom lists repeat titles that are already in the status lists
      col.lists.filter((l) => !l.isCustomList).forEach((l) =>
        l.entries.forEach((en) => out.push({
          status: en.status, progress: en.progress, updatedAt: en.updatedAt,
          item: { ...normalize(en.media, segment), partial: true },
        }))
      );
      if (!col.hasNextChunk) break;
    }
  }
  return out;
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

  return { trailer, related, whereToWatch: watchLinks(data.Media.externalLinks) };
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

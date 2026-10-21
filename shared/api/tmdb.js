// Movies & TV: the only file that talks to TMDB (themoviedb.org).
//
// Same idea as api/anilist.js: every answer is turned into the SAME item shape the
// rest of VoidPop uses ({ id, segment, title, image, genres, date, overview … }),
// with segment "movie" or "tv". Screens never see TMDB's field names.
//
// No key configured → everything is answered from demo/cinema.js, so the section
// works offline and in demo builds. With a key, results are live.
//
// IMPORTANT: a key used in the browser is visible to anyone who opens the site.
// That is fine for trying things locally. For a public site, put a small proxy in
// front (the Express backend planned in Docs/Updates.txt) and point `baseUrl` at it.
// TMDB's terms also require their logo + a "not endorsed" credit (the Movies & TV
// page shows it) and approval for commercial use.

import { formatDateParts } from "../lib/format.js";
import { DEMO_CINEMA } from "../demo/cinema.js";

const IMG = "https://image.tmdb.org/t/p";
let cfg = { apiKey: "", baseUrl: "https://api.themoviedb.org/3", language: "en-US", region: "US" };

export function configureTmdb(next = {}) {
  cfg = { ...cfg, ...Object.fromEntries(Object.entries(next).filter(([, v]) => v !== undefined && v !== null && v !== "")) };
}
export const hasTmdb = () => !!cfg.apiKey;

export const CINEMA_SEGMENTS = ["movie", "tv"];
export const CINEMA_LABEL = { movie: "Movie", tv: "Series" };
export const CINEMA_PLURAL = { movie: "Movies", tv: "Series" };
export const isCinema = (segment) => CINEMA_SEGMENTS.includes(segment);

// the genre chips on the Movies & TV page, with TMDB's ids for each kind
export const CINEMA_GENRES = [
  { name: "Action", movie: 28, tv: 10759 },
  { name: "Adventure", movie: 12, tv: 10759 },
  { name: "Animation", movie: 16, tv: 16 },
  { name: "Comedy", movie: 35, tv: 35 },
  { name: "Crime", movie: 80, tv: 80 },
  { name: "Drama", movie: 18, tv: 18 },
  { name: "Fantasy", movie: 14, tv: 10765 },
  { name: "Horror", movie: 27, tv: null }, // TMDB has no Horror genre for TV
  { name: "Mystery", movie: 9648, tv: 9648 },
  { name: "Romance", movie: 10749, tv: null },
  { name: "Sci-Fi", movie: 878, tv: 10765 },
  { name: "Thriller", movie: 53, tv: null },
];

export const CINEMA_SORTS = [
  { key: "popular", label: "Most popular" },
  { key: "rated", label: "Highest rated" },
  { key: "newest", label: "Newest first" },
  { key: "oldest", label: "Oldest first" },
  { key: "az", label: "A–Z" },
];

// TMDB's own genre names → ours
const GENRE_NAME = {
  28: "Action", 12: "Adventure", 16: "Animation", 35: "Comedy", 80: "Crime", 99: "Documentary", 18: "Drama",
  10751: "Family", 14: "Fantasy", 36: "History", 27: "Horror", 10402: "Music", 9648: "Mystery", 10749: "Romance",
  878: "Sci-Fi", 10770: "TV Movie", 53: "Thriller", 10752: "War", 37: "Western",
  10759: "Action", 10762: "Kids", 10763: "News", 10764: "Reality", 10765: "Sci-Fi", 10766: "Soap", 10767: "Talk", 10768: "War",
};
const nameOf = (g) => (typeof g === "number" ? GENRE_NAME[g] : GENRE_NAME[g.id] || g.name);
const unique = (list) => [...new Set(list.filter(Boolean))];

const today = () => new Date().toISOString().slice(0, 10);
const runtimeLabel = (min) => (min ? `${Math.floor(min / 60) ? `${Math.floor(min / 60)}h ` : ""}${min % 60}m` : null);

// One TMDB movie/show (list row or detail) → VoidPop item.
export function normalizeTmdb(r, segment) {
  const date = (segment === "movie" ? r.release_date : r.first_air_date) || null;
  const [y, m, d] = date ? date.split("-").map(Number) : [];
  const genres = unique((r.genres || r.genre_ids || []).map(nameOf));
  const title = (segment === "movie" ? r.title : r.name) || r.title || r.name || "Untitled";
  const original = segment === "movie" ? r.original_title : r.original_name;
  const minutes = segment === "movie" ? r.runtime : r.episode_run_time?.[0];
  return {
    id: r.id, segment, title,
    altTitle: original && original !== title ? original : null,
    image: r.poster_path ? `${IMG}/w500${r.poster_path}` : null,
    imageSmall: r.poster_path ? `${IMG}/w342${r.poster_path}` : null,
    color: null,
    banner: r.backdrop_path ? `${IMG}/w1280${r.backdrop_path}` : null,
    date: y ? `${y}-${String(m || 1).padStart(2, "0")}-${String(d || 1).padStart(2, "0")}` : null,
    dateLabel: formatDateParts(y, m, d),
    endDate: r.last_air_date || null,
    creator: null, // filled from the detail call (director / creators)
    genres,
    genre: genres[0] || CINEMA_LABEL[segment],
    overview: r.overview || "",
    url: `https://www.themoviedb.org/${segment}/${r.id}`,
    unreleased: !!date && date > today(),
    finished: segment === "movie" ? true : ["Ended", "Canceled"].includes(r.status),
    format: segment === "movie" ? "MOVIE" : "TV",
    country: r.origin_country?.[0] || null,
    duration: minutes || null,
    runtime: segment === "movie" ? runtimeLabel(minutes) : r.number_of_seasons ? `${r.number_of_seasons} season${r.number_of_seasons > 1 ? "s" : ""}` : null,
    popularity: r.popularity ?? null, trending: null,
    score: r.vote_count ? Math.round(r.vote_average * 10) / 10 : null,
    favourites: null,
    episodes: r.number_of_episodes ?? null, seasons: r.number_of_seasons ?? null, chapters: null,
    nextEpisode: null,
  };
}

/* ---------- requests (10-minute memory cache, so paging back is free) ---------- */

const memo = new Map();
const TTL = 10 * 60 * 1000;

async function tmdb(path, params = {}) {
  const qs = new URLSearchParams({ api_key: cfg.apiKey, language: cfg.language, ...params });
  const url = `${cfg.baseUrl}${path}?${qs}`;
  const hit = memo.get(url);
  if (hit && Date.now() - hit.at < TTL) return hit.data;
  const res = await fetch(url);
  if (!res.ok) throw new Error(res.status === 401 ? "TMDB rejected the API key." : `TMDB error ${res.status}`);
  const data = await res.json();
  memo.set(url, { at: Date.now(), data });
  return data;
}

/* ---------- demo answers (no key) ---------- */

const demoFor = (segment) => DEMO_CINEMA.filter((t) => !segment || t.segment === segment);

// Shared by the demo list and the page's own filtering of what it has loaded.
export function sortCinema(items, sort) {
  const list = [...items];
  const year = (t) => Number((t.date || "0").slice(0, 4));
  if (sort === "newest") list.sort((a, b) => year(b) - year(a));
  else if (sort === "oldest") list.sort((a, b) => year(a) - year(b));
  else if (sort === "az") list.sort((a, b) => a.title.localeCompare(b.title));
  else if (sort === "rated") list.sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
  return list;
}

export function filterCinema(items, { genre = "", query = "" } = {}) {
  const q = query.trim().toLowerCase();
  return items.filter((t) =>
    (!genre || t.genres.includes(genre)) &&
    (!q || `${t.title} ${t.altTitle || ""} ${t.genres.join(" ")} ${t.creator || ""}`.toLowerCase().includes(q)));
}

/* ---------- public API ---------- */

// A page of titles. segment: "movie" | "tv". → { items, hasMore, demo }
export async function fetchCinema(segment, { sort = "popular", genre = "", search = "", page = 1 } = {}) {
  if (!isCinema(segment)) throw new Error(`Unknown segment: ${segment}`);
  if (!hasTmdb()) {
    return { items: sortCinema(filterCinema(demoFor(segment), { genre, query: search }), sort), hasMore: false, demo: true };
  }
  let data;
  if (search.trim()) {
    data = await tmdb(`/search/${segment}`, { query: search.trim(), page, include_adult: "false" });
  } else {
    const sortBy = {
      popular: "popularity.desc", rated: "vote_average.desc",
      newest: segment === "movie" ? "primary_release_date.desc" : "first_air_date.desc",
      oldest: segment === "movie" ? "primary_release_date.asc" : "first_air_date.asc",
      az: segment === "movie" ? "original_title.asc" : "original_name.asc",
    }[sort] || "popularity.desc";
    const params = { sort_by: sortBy, page, include_adult: "false" };
    if (sort === "rated") params["vote_count.gte"] = 300; // a 10/10 from three people isn't "highest rated"
    if (sort === "newest") params[segment === "movie" ? "primary_release_date.lte" : "first_air_date.lte"] = today();
    const g = CINEMA_GENRES.find((x) => x.name === genre)?.[segment];
    if (g) params.with_genres = g;
    data = await tmdb(`/discover/${segment}`, params);
  }
  let items = data.results.filter((r) => r.poster_path).map((r) => normalizeTmdb(r, segment));
  if (search.trim() && genre) items = filterCinema(items, { genre });
  return { items, hasMore: data.page < Math.min(data.total_pages, 500), demo: false };
}

// This week's trending, movies and series mixed. → items
export async function fetchTrendingCinema() {
  if (!hasTmdb()) return [...DEMO_CINEMA];
  const data = await tmdb("/trending/all/week");
  return data.results
    .filter((r) => (r.media_type === "movie" || r.media_type === "tv") && r.poster_path)
    .map((r) => normalizeTmdb(r, r.media_type));
}

// Everything the title page shows. → { item, cast, trailer, services, demo }
export async function fetchCinemaDetail(segment, id) {
  if (!isCinema(segment)) throw new Error(`Unknown segment: ${segment}`);
  if (String(id).startsWith("demo-") || !hasTmdb()) {
    const item = DEMO_CINEMA.find((t) => String(t.id) === String(id) && t.segment === segment);
    if (!item) throw new Error("Title not found");
    return { item, cast: item.cast || [], trailer: null, services: item.services || [], demo: true };
  }
  const d = await tmdb(`/${segment}/${id}`, { append_to_response: "credits,videos,watch/providers" });
  const item = normalizeTmdb(d, segment);
  item.creator = segment === "movie"
    ? d.credits?.crew?.filter((c) => c.job === "Director").map((c) => c.name).join(", ") || null
    : d.created_by?.map((c) => c.name).join(", ") || null;
  item.vibe = d.tagline || null;
  const trailer = d.videos?.results?.find((v) => v.site === "YouTube" && v.type === "Trailer")?.key || null;
  const providers = d["watch/providers"]?.results?.[cfg.region]?.flatrate || [];
  return {
    item, trailer, demo: false,
    cast: (d.credits?.cast || []).slice(0, 8).map((c) => c.name),
    services: providers.map((p) => p.provider_name),
  };
}

export async function fetchCinemaItem(segment, id) {
  return (await fetchCinemaDetail(segment, id)).item;
}

// Titles worth showing next to this one on its page. → items
export async function fetchSimilarCinema(segment, id) {
  if (!hasTmdb() || String(id).startsWith("demo-")) return [];
  const data = await tmdb(`/${segment}/${id}/recommendations`);
  return data.results.filter((r) => r.poster_path).slice(0, 12).map((r) => normalizeTmdb(r, segment));
}

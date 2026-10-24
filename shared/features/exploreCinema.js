// What Explore loads beyond anime: movies and TV (TMDB), upcoming manga and novels (AniList), the
// Oscar and Emmy winners, new seasons of series on your shelf, and the Most loved ranking.
//
// Each loader answers in the shape the Explore state merges straight into its pools (see
// app/src/state/explore.js). The pool loaders never reject: a list that could not load is an empty
// list, never a missing one, because a tile treats a missing pool as "still loading" and would wait forever.

import { fetchAniList } from "../api/anilist.js";
import { fetchCinema, fetchTrendingCinema, fetchCinemaItem, hasTmdb } from "../api/tmdb.js";
import { readKey, writeKey } from "../backend/storage.js";
import { getCinemaShelf } from "../backend/store.js";
import { interleave } from "./exploreMix.js";

const unique = (list) => interleave([list]); // each show once, same order
const released = (list) => list.filter((it) => !it.unreleased);
const YEAR_MS = 365 * 864e5;

/* ---------- movies and TV ---------- */

// pages of one TMDB list, any page that fails counted as empty
const pages = (segment, sort, count) =>
  Promise.all(Array.from({ length: count }, (_, i) => fetchCinema(segment, { sort, page: i + 1 }).then((r) => r.items).catch(() => [])))
    .then((all) => unique(all.flat()));

// popMv / popTv  popular, already out        (Don't Miss This, VoidPop Angles, Popular in town)
// trMv / trTv    this week's trending        (Popular in town, the Billboard)
// topMv / topTv  highest rated               (the Oscars / Emmys fallback, Most loved)
// comingMv / comingTv  popular but not out yet (Coming soon)
// TMDB's popularity order carries the big upcoming releases, so Coming soon is taken from the same pages.
export async function loadCinemaPools() {
  const [movies, series, topMv, topTv, trending] = await Promise.all([
    pages("movie", "popular", 3), pages("tv", "popular", 3),
    pages("movie", "rated", 2), pages("tv", "rated", 2),
    fetchTrendingCinema().catch(() => []),
  ]);
  return {
    popMv: released(movies), popTv: released(series),
    trMv: trending.filter((it) => it.segment === "movie"), trTv: trending.filter((it) => it.segment === "tv"),
    topMv: released(topMv), topTv: released(topTv),
    comingMv: movies.filter((it) => it.unreleased), comingTv: series.filter((it) => it.unreleased),
  };
}

/* ---------- upcoming manga and novels ---------- */

// → { comingM, comingN }: announced, not out yet, most popular first (Coming soon sorts them by date)
export async function loadComingBooks() {
  const get = (segment) => fetchAniList(segment, { sort: "popular", unreleasedOnly: true, perPage: 25 }).then((r) => r.items).catch(() => []);
  const [comingM, comingN] = await Promise.all([get("manga"), get("novel")]);
  return { comingM, comingN };
}

/* ---------- Oscars and Emmys ---------- */

// Fixed picks, like Anime of the Year (awards.js): add the new winner at the top each year.
// made = the year the film came out / the series began, to tell it from older titles with the same name.
// Oscars: Best Picture, newest first. Source: https://en.wikipedia.org/wiki/Academy_Award_for_Best_Picture
const OSCARS = [
  { title: "One Battle After Another", made: 2025 }, // 2026
  { title: "Anora", made: 2024 }, // 2025
  { title: "Oppenheimer", made: 2023 }, // 2024
  { title: "Everything Everywhere All at Once", made: 2022 }, // 2023
  { title: "CODA", made: 2021 }, // 2022
  { title: "Nomadland", made: 2020 }, // 2021
  { title: "Parasite", made: 2019 }, // 2020
  { title: "Green Book", made: 2018 }, // 2019
  { title: "The Shape of Water", made: 2017 }, // 2018
  { title: "Moonlight", made: 2016 }, // 2017
];
// Emmys: every Outstanding Drama Series and Outstanding Comedy Series winner since 2017, each show once, in
// order of its latest win. Source: https://en.wikipedia.org/wiki/Primetime_Emmy_Award_for_Outstanding_Drama_Series
const EMMYS = [
  { title: "The Pitt", made: 2025 }, // drama 2025, 2026
  { title: "Widow's Bay", made: 2026 }, // comedy 2026
  { title: "The Studio", made: 2025 }, // comedy 2025
  { title: "Shōgun", made: 2024 }, // drama 2024
  { title: "Hacks", made: 2021 }, // comedy 2024
  { title: "Succession", made: 2018 }, // drama 2020, 2022, 2023 (held Jan 2024)
  { title: "The Bear", made: 2022 }, // comedy 2023 (held Jan 2024)
  { title: "Ted Lasso", made: 2020 }, // comedy 2021, 2022
  { title: "The Crown", made: 2016 }, // drama 2021
  { title: "Schitt's Creek", made: 2015 }, // comedy 2020
  { title: "Fleabag", made: 2016 }, // comedy 2019
  { title: "Game of Thrones", made: 2011 }, // drama 2018, 2019
  { title: "The Marvelous Mrs. Maisel", made: 2017 }, // comedy 2018
  { title: "The Handmaid's Tale", made: 2017 }, // drama 2017
  { title: "Veep", made: 2012 }, // comedy 2017
];

const AWARDS_KEY = "voidation:awards:v1";
const AWARDS_TTL = 7 * 864e5;
const LIST_SIG = `${OSCARS.length}:${OSCARS[0].title}|${EMMYS.length}:${EMMYS[0].title}`; // a new winner at the top refreshes the saved copy

// "Shōgun" and "Shogun", "Widow's Bay" and "Widow’s Bay" are the same title
const plain = (s) => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "");
const yearOf = (it) => Number(String(it.date || "").slice(0, 4)) || 0;

// the TMDB entry for one winner: the title must match exactly; among those, the one made that year
async function findWinner(segment, { title, made }) {
  try {
    const found = (await fetchCinema(segment, { search: title })).items.filter((it) => plain(it.title) === plain(title) || plain(it.altTitle) === plain(title));
    return found.find((it) => Math.abs(yearOf(it) - made) <= 1) || found[0] || null;
  } catch { return null; }
}
const findAll = async (segment, list) => unique((await Promise.all(list.map((w) => findWinner(segment, w)))).filter(Boolean));

// → { oscars, emmys } (each a list of titles, [] when they can't load yet: the tile then shows top rated instead).
// Looked up once and kept on the device for a week.
export async function loadAwards() {
  let saved = null;
  try { saved = JSON.parse((await readKey(AWARDS_KEY)) || "null"); } catch { saved = null; }
  if (saved?.sig !== LIST_SIG) saved = null;
  const old = { oscars: saved?.oscars || [], emmys: saved?.emmys || [] };
  if (saved && old.oscars.length && old.emmys.length && Date.now() - saved.at < AWARDS_TTL) return old;
  if (!hasTmdb()) return old; // nothing to look the winners up in

  const [oscars, emmys] = await Promise.all([findAll("movie", OSCARS), findAll("tv", EMMYS)]);
  // keep the lookup unless a good part of it failed (then the next launch tries again)
  if (oscars.length >= OSCARS.length * 0.7 && emmys.length >= EMMYS.length * 0.7) {
    try { await writeKey(AWARDS_KEY, JSON.stringify({ at: Date.now(), sig: LIST_SIG, oscars, emmys })); } catch { /* not saved: looked up again next time */ }
  }
  return { oscars: oscars.length ? oscars : old.oscars, emmys: emmys.length ? emmys : old.emmys };
}

/* ---------- new seasons of series you watched ---------- */

// Series on your shelf that have a new season: more seasons than when you saved it, or a series you finished that is
// still running and aired in the last 12 months. Newest episode first. Needs TMDB (nothing to compare with offline).
// Like Jump back in, these are your own series, so Explore doesn't filter them against your library.
export async function loadNewSeasonsTv() {
  if (!hasTmdb()) return [];
  const mine = (await getCinemaShelf())
    .filter((e) => e.item?.segment === "tv" && ["completed", "watching", "rewatching"].includes(e.status))
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
    .slice(0, 25); // each is one request (TMDB answers are kept for 10 minutes)
  const now = Date.now();
  const checked = await Promise.all(mine.map(async (e) => {
    try {
      const cur = await fetchCinemaItem("tv", e.item.id);
      const grew = Number.isFinite(e.item.seasons) && Number.isFinite(cur.seasons) && cur.seasons > e.item.seasons;
      const lastAired = cur.endDate ? Date.parse(cur.endDate) : NaN;
      const airing = !cur.finished && now - lastAired < YEAR_MS;
      return grew || (airing && e.status === "completed") ? { item: cur, lastAired: lastAired || 0 } : null;
    } catch { return null; }
  }));
  return checked.filter(Boolean).sort((a, b) => b.lastAired - a.lastAired).slice(0, 20).map((x) => x.item);
}

/* ---------- Most loved ---------- */

// The Most loved ranking: the most favourited anime, manga and novels (AniList) with the highest rated movies and
// series (TMDB), taken in turns. → { items, from }. from is "mixed" here; the tile also understands "community"
// (what VoidPop's own members love), but the server has no ranking route yet, so that source is not wired in.
// Rejects when nothing loaded at all, so the caller falls back to the anime list it already has.
export async function loadMostLoved(lovedAnime = [], topMv = [], topTv = []) {
  const loved = (segment) => fetchAniList(segment, { sort: "loved", perPage: 25 }).then((r) => r.items).catch(() => []);
  const [manga, novels] = await Promise.all([loved("manga"), loved("novel")]);
  const items = interleave([lovedAnime, manga, novels, topMv, topTv], 100);
  if (!items.length) throw new Error("Nothing to rank yet.");
  return { items, from: "mixed" };
}

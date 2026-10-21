// Movies & TV: the rules (no drawing, no network). Ideas from the Talehouse concept:
// curated collections, "More like this", and a featured pick for the hero.

import { isCinema } from "../api/tmdb.js";

export { isCinema };

// Each collection is a RULE, not a fixed list of ids, so it works the same with the
// sample catalog and with live TMDB data.
export const COLLECTIONS = [
  {
    key: "editors-shelf", title: "The quiet shelf", subtitle: "Stories that linger long after the credits.", icon: "star",
    segment: "movie", genres: ["Drama", "Romance", "Mystery", "Sci-Fi"], minScore: 7.5,
  },
  {
    key: "weekend", title: "For the weekend", subtitle: "Make the next two hours count.", icon: "flame",
    segment: "movie", genres: ["Action", "Adventure", "Animation", "Horror", "Sci-Fi"],
  },
  {
    key: "one-more", title: "One more episode", subtitle: "The “just one more” kind of shows.", icon: "tv",
    segment: "tv", genres: [],
  },
];

// pool → [{ ...collection, items }]. A title shows up in one collection only, and
// a collection with fewer than `min` titles is left out rather than shown thin.
export function buildCollections(pool, { size = 4, min = 3 } = {}) {
  const used = new Set();
  const out = [];
  for (const c of COLLECTIONS) {
    const fits = (t, strict) =>
      !used.has(`${t.segment}:${t.id}`) && t.segment === c.segment &&
      (!strict || ((!c.genres.length || t.genres.some((g) => c.genres.includes(g))) && (!c.minScore || t.score == null || t.score >= c.minScore)));
    // best matches first (more genres in common), then anything of the right kind
    const strong = pool.filter((t) => fits(t, true))
      .sort((a, b) => overlap(b.genres, c.genres) - overlap(a.genres, c.genres));
    const items = [...strong, ...pool.filter((t) => fits(t, false) && !strong.includes(t))].slice(0, size);
    if (items.length < min) continue;
    items.forEach((t) => used.add(`${t.segment}:${t.id}`));
    out.push({ ...c, items });
  }
  return out;
}
const overlap = (a, b) => a.filter((g) => b.includes(g)).length;

// The hero: the first title that has a backdrop and a synopsis.
export const featuredPick = (pool) => pool.find((t) => t.banner && t.overview) || pool[0] || null;

// "More like this": same kind of story, found by shared genres. Titles you've
// already rated Void It are left out. (Later this can use community verdicts and moods.)
export function moreLikeThis(item, pool, { exclude = [], limit = 6 } = {}) {
  const skip = new Set(exclude);
  return pool
    .filter((t) => !(t.segment === item.segment && String(t.id) === String(item.id)) && !skip.has(`${t.segment}:${t.id}`))
    .map((t) => ({
      t,
      score: overlap(t.genres || [], item.genres || []) * 2 + (t.segment === item.segment ? 1 : 0) + (t.creator && t.creator === item.creator ? 2 : 0),
    }))
    .filter((x) => x.score > 1)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.t);
}

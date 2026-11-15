// FILE: shared/features/exploreShelf.js — the games and comics pools Explore merges into its state (like exploreCinema.js does
// for movies and TV). Never rejects: a list that could not load is an empty list, never a missing one.
import { fetchShelf } from "../api/shelf.js";

// popG / popC       games already out, comics         (Don't Miss This, Popular in town, VoidPop Angles)
// comingG / comingC games not out yet, comics with a next issue coming  (Coming soon, soonest first)
export async function loadShelfPools() {
  const get = (segment, sort) => fetchShelf(segment, { sort }).then((r) => r.items).catch(() => []);
  const [popG, comingG, popC, comingC] = await Promise.all([get("game", "popular"), get("game", "coming"), get("comic", "popular"), get("comic", "coming")]);
  return { popG: popG.filter((it) => !it.unreleased), comingG, popC, comingC };
}

// Marking Season 3 as Watching / Completed / On Hold / Dropped means you've seen
// Seasons 1 and 2, so they're marked Completed too (only if they aren't in your
// library yet: a season you already marked, e.g. Dropped, is left alone).
// Plan to Watch doesn't count: planning Season 3 says nothing about Season 1.
// Returns the titles it marked, so the screen can say so (with Undo).

import { fetchEarlierSeasons } from "./api/anilist.js";
import { getLibrary, setStatus } from "./backend/store.js";

const STARTED = new Set(["watching", "completed", "rewatching", "onhold", "dropped"]);

export async function completeEarlierSeasons(item, status) {
  if (item.segment !== "anime" || !STARTED.has(status)) return [];
  let earlier = [];
  try { earlier = await fetchEarlierSeasons(item.id); } catch { return []; } // offline: nothing marked
  const lib = await getLibrary();
  const added = [];
  for (const s of earlier) {
    if (lib[`anime:${s.id}`]) continue;
    await setStatus(null, "anime", s, "completed");
    added.push(s);
  }
  return added;
}

// Undo: take those titles back out (only if they're still just "Completed" from this).
export async function undoEarlierSeasons(items) {
  for (const s of items) await setStatus(null, "anime", s, null);
}

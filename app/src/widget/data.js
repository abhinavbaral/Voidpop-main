// What the two home-screen widgets show (the logic is in shared/features/widgetPending.js and has tests; this file
// loads the library and the air times). Fresh times from AniList when online; the saved library snapshots otherwise,
// so the widgets still work without internet. A widget never writes to your library.
import { fetchNextEpisodes, fetchRecentEpisodes } from "@voidpop/shared/api/anilist";
import { getLibrary, getExcited, yourShows } from "@voidpop/shared/backend/store";
import { pendingView, oldestPending } from "@voidpop/shared/features/widgetPending";

const FOLLOWING = new Set(["watching", "plan", "onhold"]);

// Pending view (4x4): everything you follow that is ongoing, pending ones first, each with its count and next episode.
// quick: saved data only (no network), so the widget can draw immediately
export async function loadPendingView({ quick = false } = {}) {
  const [lib, excitedMap] = await Promise.all([getLibrary(), getExcited()]);
  const inLib = new Set(Object.values(lib).map((e) => String(e.item.id)));
  const excitedAnime = Object.values(excitedMap).filter((e) => e.item.segment === "anime" && !inLib.has(String(e.item.id)));
  const ids = [
    ...Object.values(lib).filter((e) => e.item.segment === "anime" && FOLLOWING.has(e.status)).map((e) => String(e.item.id)),
    ...excitedAnime.map((e) => String(e.item.id)),
  ];
  let fresh = {};
  if (!quick && ids.length) {
    try { fresh = await fetchNextEpisodes(ids); } catch { /* offline: the saved copies are used */ }
  }
  // merged in memory only
  return pendingView(yourShows(lib, fresh), excitedAnime.map((e) => fresh[e.item.id] || e.item));
}

// Ongoing anime you are Watching and are behind on: the Schedule's list (airing now, or finished within two weeks),
// never the finished shows under More → You're watching. Same numbers as the badge on the Schedule tab.
async function behindShows({ quick }) {
  const lib = await getLibrary();
  const ids = Object.values(lib).filter((e) => e.item.segment === "anime" && e.status === "watching").map((e) => String(e.item.id));
  let fresh = {};
  if (!quick && ids.length) {
    try { fresh = await fetchNextEpisodes(ids); } catch { /* offline */ }
  }
  return yourShows(lib, fresh).filter((x) => x.pending > 0 && x.entry.status === "watching");
}

// Pending pager (4x2): the shows with episodes waiting, longest-waiting first.
// { total, count, rows: [{ id, title, image, episode, airedAt, estimated, pending }] }
export async function loadPendingPager({ quick = false } = {}) {
  const behind = await behindShows({ quick });
  const aired = {};
  if (!quick && behind.length) {
    try { // exact air times for the last 4 months; older than that (or offline) falls back to a weekly estimate
      (await fetchRecentEpisodes(behind.map((x) => String(x.item.id)), 120)).forEach((r) => { aired[`${r.item.id}:${r.episode}`] = r.airingAt; });
    } catch { /* offline */ }
  }
  return oldestPending(behind, aired);
}

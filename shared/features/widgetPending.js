// What the two home-screen widgets show. Pure functions: the app loads the library and the air times
// (app/src/widget/data.js) and hands them here.
//   Pending view (4x4): every ongoing show with how many episodes are pending and its next episode
//   Pending pager (4x2): the shows with pending episodes, one at a time, oldest first, with an arrow to go to the next
//
// "Ongoing" means the same as the Schedule and its badge: anime you are Watching that are airing now, or that
// finished within the last two weeks. Finished shows you are catching up on (More → You're watching) and
// Rewatching are NOT counted, so the number matches the badge on the Schedule tab.
//
//   behind: yourShows(...) rows ({ entry, item, next, pending }) with pending > 0

import { nextToWatch } from "../backend/store.js";

const WEEK = 7 * 86400;

// The Pending view: pending shows first (most episodes waiting first), then the rest by their next episode.
//   shows: yourShows(...) rows for everything you follow ({ entry, item, next, pending, delay })
//   excited: anime you're Excited about (no library entry): upcoming only, nothing pending
// Each row: { id, title, image, pending, next: { episode, airingAt } | null, delayed }
export function pendingView(shows, excited = [], now = Date.now(), limit = 30) {
  const nowS = now / 1000;
  const rows = shows.map((x) => ({ id: x.item.id, title: x.item.title, image: x.item.image, pending: x.pending || 0, next: x.next, delayed: !!x.delay }));
  const have = new Set(rows.map((r) => String(r.id)));
  excited.forEach((it) => {
    if (have.has(String(it.id)) || !it.nextEpisode || it.nextEpisode.airingAt <= nowS) return;
    rows.push({ id: it.id, title: it.title, image: it.image, pending: 0, next: it.nextEpisode, delayed: false });
  });
  const at = (r) => r.next?.airingAt ?? Infinity;
  rows.sort((a, b) => (b.pending > 0) - (a.pending > 0) || (a.pending > 0 ? b.pending - a.pending : 0) || at(a) - at(b));
  return { total: rows.reduce((n, r) => n + r.pending, 0), pendingShows: rows.filter((r) => r.pending > 0).length, rows: rows.slice(0, limit) };
}

// The oldest unwatched episode of every ongoing show, oldest first (the Pending pager goes through them in this order).
//   aired: { "<mediaId>:<episode>": airingAt } from AniList's recent episodes (exact times)
// A show with no exact time gets one worked out from its next episode, assuming weekly releases
// (estimated: true). One with neither goes last.
export function oldestPending(behind, aired = {}) {
  const rows = behind.map((x) => {
    const episode = nextToWatch(x.entry); // first episode you haven't watched (skips the ones you skipped)
    const exact = aired[`${x.item.id}:${episode}`];
    const guess = x.item.nextEpisode ? x.item.nextEpisode.airingAt - (x.item.nextEpisode.episode - episode) * WEEK : null;
    return {
      id: x.item.id, title: x.item.title, image: x.item.image, pending: x.pending, episode,
      airedAt: exact ?? guess, estimated: exact == null && guess != null,
    };
  });
  rows.sort((a, b) => (a.airedAt ?? Infinity) - (b.airedAt ?? Infinity) || b.pending - a.pending);
  return { total: behind.reduce((n, x) => n + x.pending, 0), count: rows.length, rows, oldest: rows[0] || null, then: rows.slice(1, 3) };
}

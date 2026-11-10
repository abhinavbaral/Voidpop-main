// Which "next episode" to trust. Pure logic: no network, no storage, easy to test.
//
// A next episode is { episode, airingAt (unix seconds) }. It can come from:
//   - AniList        an exact time for ONE episode (the app's main source)
//   - Shikimori      an exact time for one episode, from a different database
//   - MyAnimeList    only a weekly slot ("Saturdays 22:30 JST"), no episode number, so it can
//                    confirm a time but never produce one
//
// Rules, in order:
//   1. An exact time that has not passed wins. AniList first, then Shikimori.
//   2. If every exact time has passed (AniList is slow, rate limited or unreachable and an old saved
//      answer was used), the last known time is carried forward week by week and marked
//      `estimated: true`. A passed time is never shown as "next".
//   3. Sources that agree add to `confirmedBy`; a weekly slot that matches adds one too.

export const WEEK_S = 7 * 86400;
// formatCountdown() says "Airing now" for the first hour after air time, so a time is only out of date after that
export const GRACE_S = 3600;
const AGREE_S = 15 * 60; // two exact times this close are the same time
const SLOT_TOLERANCE_S = 30 * 60;

const nowSec = (now) => Math.floor(now / 1000);

// The time has passed by more than the "Airing now" hour.
export const isStale = (next, now = Date.now()) => !!next && next.airingAt <= nowSec(now) - GRACE_S;

// A passed "next episode" carried forward by whole weeks to the first slot that has not passed.
//   episode 7 on Sat 7 Nov, looked at on Mon 9 Nov  ->  episode 8 on Sat 14 Nov (estimated)
// episodes: the known total (null while unknown); past it the run is over and there is no next episode.
// The total only limits the guess while it agrees with the episode we know (an episode past it means the total is wrong).
// A time that has not passed is returned untouched (the same object).
export function projectStale(next, { episodes = null, now = Date.now() } = {}) {
  if (!next) return null;
  if (!isStale(next, now)) return next;
  const k = Math.floor((nowSec(now) - GRACE_S - next.airingAt) / WEEK_S) + 1; // weekly slots to skip, at least 1
  const episode = next.episode + k;
  if (episodes > 0 && next.episode <= episodes && episode > episodes) return null;
  return { episode, airingAt: next.airingAt + k * WEEK_S, estimated: true };
}

/* ---------- weekly broadcast slot (MyAnimeList) ---------- */

// MyAnimeList lists broadcast times in Japan time. Japan has no daylight saving, so a fixed +9 is exact.
const JST_S = 9 * 3600;
const DAY_S = 86400;
const DOW = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };

// { day: "Saturdays", time: "22:30", timezone: "Asia/Tokyo" } -> { phase } (seconds into the week, Sunday 00:00 JST), or null
export function parseBroadcast(b) {
  if (!b || typeof b.day !== "string" || typeof b.time !== "string") return null;
  if (b.timezone && b.timezone !== "Asia/Tokyo") return null; // only Japan time is understood
  const d = DOW[b.day.slice(0, 3).toLowerCase()];
  const m = /^(\d{1,2}):(\d{2})/.exec(b.time);
  if (d == null || !m || +m[1] > 23 || +m[2] > 59) return null;
  return { phase: d * DAY_S + +m[1] * 3600 + +m[2] * 60 };
}

// where a unix time falls in the JST week: seconds since Sunday 00:00 JST
// (1 Jan 1970 was a Thursday, 4 days after Sunday)
const weekPhase = (t) => (((t + JST_S + 4 * DAY_S) % WEEK_S) + WEEK_S) % WEEK_S;

// does this air time land on the weekly slot (give or take half an hour, in either direction around the week)?
export function onSlot(slot, airingAt) {
  if (!slot) return false;
  const diff = ((weekPhase(airingAt) - slot.phase + WEEK_S / 2 + WEEK_S) % WEEK_S) - WEEK_S / 2;
  return Math.abs(diff) <= SLOT_TOLERANCE_S;
}

/* ---------- choosing between sources ---------- */

// anilist, shikimori: { episode, airingAt } | null    slot: parseBroadcast() | null
// Returns { episode, airingAt, ... } or null (no next episode known).
// Extra fields only when there is something to say: `estimated`, `source` (when not AniList), `confirmedBy`.
export function reconcileNext({ anilist = null, shikimori = null, slot = null, episodes = null, now = Date.now() } = {}) {
  const fresh = (c) => c && !isStale(c, now);
  const primary = fresh(anilist) ? anilist : fresh(shikimori) ? shikimori : null;

  if (!primary) {
    // nothing exact is left: carry the most recent known time forward
    const known = [anilist, shikimori].filter(Boolean).sort((a, b) => b.airingAt - a.airingAt)[0];
    return projectStale(known || null, { episodes, now });
  }

  // a different exact source that says the same thing, and a weekly slot that fits, each add confidence
  const others = primary === anilist ? [shikimori] : [anilist];
  let confirmedBy = 0;
  for (const o of others) if (fresh(o) && o.episode === primary.episode && Math.abs(o.airingAt - primary.airingAt) <= AGREE_S) confirmedBy++;
  if (onSlot(slot, primary.airingAt)) confirmedBy++;

  const out = { episode: primary.episode, airingAt: primary.airingAt };
  if (primary !== anilist) out.source = "shikimori";
  if (confirmedBy) out.confirmedBy = confirmedBy + 1; // + the source itself: "2" means two sources say so
  return primary === anilist && !confirmedBy ? anilist : out;
}

/* ---------- stale saved answers ---------- */

// A saved AniList answer is wrong NOW if a countdown in it ran out after it was saved: it still says "episode 7,
// Saturday" while AniList has long moved on to episode 8. (A countdown that had ALREADY run out when it was
// saved is AniList's own lag; fetching again right away would not change it.)
const AIRING = /"nextAiringEpisode":\{[^}]*?"airingAt":(\d+)/g;
export function airingPassedSince(data, savedAtMs, now = Date.now()) {
  let text;
  try { text = JSON.stringify(data); } catch { return false; }
  if (!text || text.indexOf("nextAiringEpisode") < 0) return false;
  const savedS = Math.floor(savedAtMs / 1000), nowS = nowSec(now);
  for (const m of text.matchAll(AIRING)) {
    const t = Number(m[1]);
    if (t > savedS && t <= nowS) return true;
  }
  return false;
}

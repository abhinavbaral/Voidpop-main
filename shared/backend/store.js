// VoidPop data layer. Shared by the app AND the website: every screen talks
// ONLY to these functions, so both clients keep the same data in the same shape.
//
// There are no accounts. Everything lives in one JSON document on this device
// (see storage.js):
//   library  {"segment:id" -> { status, progress, cats, item snapshot, updatedAt, addedAt?, delay? }}
//   categories [{ id, name }]  no longer used: the feature was removed. Kept as is so old backups restore
//                              and export unchanged (entries may carry a matching `cats` list too)
//   reviews  {"segment:id" -> { verdict, vibes, moods, comment, date }}
//   excited  {"segment:id" -> { item, at }}
//   settings { clock24, posterBadges, notifyEpisodes }
//   log      [[time ms, "segment:id", change, source], …] every progress change
//            (source: plus / typed / history / complete) and status change
//            (change 0, source "status:completed" etc.). Powers stats and History;
//            imports and AniList pulls are never logged.
//
// Functions still take `user` as their first argument, so screens written for
// the account version didn't have to change. It is always the local user.

import { readKey, writeKey } from "./storage.js";
import { fillerFor, canSkip, countIn, inRanges, addRange, removeRange, lastListed } from "../features/fillers.js";

const DB_KEY = "voidation:db:v1";
// notifyEpisodes only matters in the app (the website can't schedule alerts)
// logo: which logo the app shows (see Brand.js): "classic", "voidmon" or "peeking"
export const DEFAULT_SETTINGS = { clock24: false, posterBadges: true, notifyEpisodes: true, seasonLayout: "grid", logo: "classic", libraryLayout: "compact", name: "", nameAsked: false };
// the first Movies & TV version called a finished title "watched"; it is now "completed" like the rest of the Library
function renameWatched(cinema) {
  for (const e of Object.values(cinema)) if (e.status === "watched") e.status = "completed";
  return cinema;
}

const EMPTY = () => ({ library: {}, reviews: {}, excited: {}, cinema: {}, notes: {}, log: [], categories: [], meta: {}, settings: { ...DEFAULT_SETTINGS } });

let cache = null;
let writing = Promise.resolve();

async function load() {
  if (cache) return cache;
  try {
    const raw = await readKey(DB_KEY);
    const saved = raw ? JSON.parse(raw) : {};
    cache = { ...EMPTY(), ...saved, log: Array.isArray(saved.log) ? saved.log : [],
      categories: Array.isArray(saved.categories) ? saved.categories : [], settings: { ...DEFAULT_SETTINGS, ...(saved.settings || {}) } };
    if (!cache.cinema || typeof cache.cinema !== "object") cache.cinema = {}; // data saved before Movies & TV has none
    renameWatched(cache.cinema);
  } catch {
    cache = EMPTY(); // corrupt or unreadable storage: start clean rather than crash
  }
  return cache;
}

// Anyone who needs to react to changes (the app reschedules episode alerts and
// backups) subscribes here. Returns an unsubscribe function.
const listeners = new Set();
export function onDataChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// Writes are queued so two quick taps can't save an older copy over a newer one.
function save() {
  const snapshot = JSON.stringify(cache);
  writing = writing.then(() => writeKey(DB_KEY, snapshot)).catch(() => {});
  listeners.forEach((fn) => { try { fn(); } catch { /* a listener must never break saving */ } });
  return writing;
}

const keyOf = (segment, id) => `${segment}:${id}`;

// AniList sync listens here for YOUR changes (status, progress, removal).
// Changes that come FROM AniList (applyAniListPull) don't call it, so nothing
// bounces back and forth.
let entryHook = null;
export function setEntryChangeHook(fn) { entryHook = fn; }
function entryChanged(key, entry) {
  try { entryHook?.(key, entry ? { status: entry.status, progress: entry.progress || 0, item: entry.item } : null); } catch { /* sync must never break saving */ }
}

function logChange(db, key, change, source) {
  if (change) db.log.push([Date.now(), key, change, source]);
}
function logStatus(db, key, prevStatus, status) {
  if (prevStatus !== status) db.log.push([Date.now(), key, 0, `status:${status || "removed"}`]);
}

// The watch log (read-only copy), oldest first.
export async function getLog() {
  return [...(await load()).log];
}

/* ---------- tracking ---------- */

// Rewatching / Rereading: a finished title you've started again. It still
// counts as finished everywhere (stats, ranks); progress starts from 0,
// and reaching the end puts it back in Completed with one more rewatch counted.
export const isDone = (status) => status === "completed" || status === "rewatching";

export function statusesFor(segment) {
  // Movies have their own playlists (nothing to count: you plan to see one, you're unsure, or you saw it).
  // TV uses the same ones as Anime, so it falls through to the list below.
  if (segment === "movie") {
    return [{ key: "plan", label: "Plan to Watch" }, { key: "considering", label: "Considering" }, { key: "completed", label: "Watched" }];
  }
  const reading = segment === "manga";
  return [
    { key: "watching", label: reading ? "Reading" : "Watching" },
    { key: "completed", label: reading ? "Finished" : "Completed" },
    { key: "rewatching", label: reading ? "Rereading" : "Rewatching" },
    { key: "plan", label: reading ? "Plan to Read" : "Plan to Watch" },
    // Undecided: you're not sure you'll watch/read it. Kept on this phone only (AniList has no
    // such status), left off Schedule, alerts, the widget and the stats.
    { key: "considering", label: "Considering" },
    { key: "onhold", label: "On Hold" },
    { key: "dropped", label: "Dropped" },
  ];
}

// Not out yet: you can only plan or consider it (and mark Excited). Watching, Completed,
// On Hold, Dropped, progress and verdicts open once it starts airing.
export function statusesAllowed(item) {
  const all = statusesFor(item.segment);
  return item.unreleased ? all.filter((s) => s.key === "plan" || s.key === "considering") : all;
}

export async function getLibrary() {
  const db = await load();
  return { ...db.library };
}

// Movies and series sit beside your anime and manga in the Library, but are stored apart (see `cinema`
// above). The Library screens read both through this: a movie or series looks like any other entry
// (status, updatedAt), with no progress to count.
const asEntry = (e) => ({
  item: e.item, status: e.status, progress: 0,
  addedAt: new Date(e.addedAt || 0).toISOString(), updatedAt: new Date(e.updatedAt || 0).toISOString(),
});
export async function getLibraryAll() {
  const db = await load();
  const movies = Object.fromEntries(Object.entries(db.cinema).map(([k, e]) => [k, asEntry(e)]));
  return { ...db.library, ...movies };
}

export async function getStatus(_user, segment, id) {
  const db = await load();
  return db.library[keyOf(segment, id)]?.status ?? null;
}

export async function setStatus(_user, segment, item, status) {
  const db = await load();
  const key = keyOf(segment, item.id);
  if (status === null) {
    logStatus(db, key, db.library[key]?.status, null);
    delete db.library[key];
    entryChanged(key, null);
    return save();
  }
  const prev = db.library[key];
  const total = totalFor({ ...item, segment });
  // finishing a title fills its progress, the way AniList does
  const progress = status === "completed" && total ? total
    : status === "rewatching" && prev?.status !== "rewatching" ? 0
    : prev?.progress || 0;
  logChange(db, key, progress - (prev?.progress || 0), "complete");
  logStatus(db, key, prev?.status, status);
  db.library[key] = {
    ...(prev ? {} : { addedAt: new Date().toISOString() }), // when it joined your library (Library → Date added)
    ...prev,
    status,
    progress,
    item: freshest(prev?.item, { ...item, segment }),
    updatedAt: new Date().toISOString(),
  };
  entryChanged(key, db.library[key]);
  return save();
}

// Keep the fuller copy: an item imported from AniList has no synopsis or
// creator until its page is opened once.
function freshest(prev, next) {
  if (!prev) return next;
  return next.partial && !prev.partial ? { ...prev, ...pick(next, ["nextEpisode", "finished", "episodes", "chapters", "endDate"]) } : next;
}
const pick = (o, keys) => Object.fromEntries(keys.filter((k) => o[k] !== undefined).map((k) => [k, o[k]]));

export async function getEntry(segment, id) {
  const e = (await load()).library[keyOf(segment, id)];
  return e ? { ...e } : null;
}

/* ---------- progress: episodes watched / chapters read ---------- */

export const unitFor = (segment) => (segment === "manga" ? "Ch" : "Ep");
export const totalFor = (item) => (item.segment === "manga" ? item.chapters : item.episodes) ?? null;
// Episodes out so far: everything before the next one to air, or all of them once finished.
export function airedFor(item) {
  if (item.segment !== "anime") return null;
  if (item.nextEpisode) {
    // a saved "next episode" whose time has passed is out, even before we
    // get fresh data (offline, or the app hasn't checked yet)
    const out = item.nextEpisode.airingAt <= Date.now() / 1000;
    return item.nextEpisode.episode - (out ? 0 : 1);
  }
  return item.finished ? item.episodes ?? null : null;
}
// A show that finished airing stays on Schedule for this many days (so you can
// catch up on what you missed), then moves to More > You're watching.
export const WRAP_UP_DAYS = 14;

// True once a show has been finished airing for more than WRAP_UP_DAYS.
// Finished but no end date saved yet (an old saved copy): counts as long ago,
// and the date arrives with the next AniList refresh.
export function pastWrapUp(item, now = Date.now()) {
  if (item.segment !== "anime" || !item.finished) return false;
  if (!item.endDate) return true;
  const end = Date.parse(`${item.endDate}T23:59:59Z`); // the last episode aired on this day
  return Number.isNaN(end) ? true : now - end > WRAP_UP_DAYS * 86400000;
}

/* ---------- skipped episodes: filler / anime canon you chose not to watch ---------- */
// entry.skipped = episode ranges, e.g. [[54, 61]]. Skipped episodes count toward
// finishing a show but are not "watched": they stay out of the stats, the
// achievements and the "behind" counts. progress is still the episode you're up to.
// Anime only, and local only (AniList has no such thing, so nothing is synced).

export const skippedOf = (entry) => entry?.skipped || [];
// how many of the first `upTo` episodes you skipped
export const skippedUpTo = (entry, upTo) => countIn(skippedOf(entry), 1, upTo);
// episodes you actually watched up to there (default: up to your progress)
export const watchedOf = (entry, upTo = entry?.progress || 0) => Math.max(0, upTo - skippedUpTo(entry, upTo));
// the next episode you still have to watch: after your progress, past any skipped ones
export function nextToWatch(entry) {
  const skipped = skippedOf(entry);
  let n = (entry?.progress || 0) + 1;
  while (inRanges(skipped, n)) n++;
  return n;
}

// Skip episodes from..to. Only filler and anime-canon episodes (per the filler
// database) that you haven't reached yet can be skipped; anything else in the
// range is left alone. Returns how many were newly skipped.
export async function skipEpisodes(item, from, to = from) {
  const db = await load();
  const e = db.library[keyOf("anime", item.id)];
  const info = fillerFor({ ...item, segment: "anime" });
  if (!e || !info || e.item.segment !== "anime") return { skipped: 0 };
  const last = Math.min(to, totalFor(item) || lastListed(info));
  let next = skippedOf(e);
  let skipped = 0;
  for (let ep = Math.max(from, (e.progress || 0) + 1); ep <= last; ep++) {
    if (canSkip(info, ep) && !inRanges(next, ep)) { next = addRange(next, ep); skipped++; }
  }
  if (!skipped) return { skipped: 0 };
  e.skipped = next;
  e.updatedAt = new Date().toISOString();
  await save();
  return { skipped };
}

// Put skipped episodes back (they become unseen again).
export async function unskipEpisodes(item, from, to = from) {
  const db = await load();
  const e = db.library[keyOf("anime", item.id)];
  if (!e || !skippedOf(e).length) return { unskipped: 0 };
  const before = countIn(e.skipped, from, to);
  if (!before) return { unskipped: 0 };
  const next = removeRange(e.skipped, from, to);
  if (next.length) e.skipped = next; else delete e.skipped;
  e.updatedAt = new Date().toISOString();
  await save();
  return { unskipped: before };
}

// Library badge: episodes (or chapters) that are out and you haven't watched.
// 24-episode show, 23 out, watched 3 → 20. Watched all 23 → 0 (no badge).
// Completed → 0. Ongoing manga (no known chapter count) → null (no badge).
export function leftToWatch(entry) {
  if (entry.status === "completed") return 0;
  const item = entry.item;
  const out = item.segment === "anime" ? airedFor(item) ?? totalFor(item) : totalFor(item);
  if (out == null) return null;
  if (entry.status === "considering") return null; // undecided: no "new episodes" badge
  const progress = entry.progress || 0;
  return Math.max(0, out - progress - countIn(skippedOf(entry), progress + 1, out)); // skipped ones aren't "to watch"
}

// Completed means everything is watched / read: "✓ All 12 watched".
export function doneLabel(item) {
  const total = totalFor(item);
  const verb = item.segment === "manga" ? "read" : "watched";
  return total ? `✓ All ${total} ${verb}` : `✓ All ${verb}`;
}

// A completed title whose episode count wasn't known when you finished it gets
// its progress filled in once the count is known (e.g. its page was opened).
export async function fillCompleted(item) {
  const db = await load();
  const e = db.library[keyOf(item.segment, item.id)];
  const total = totalFor(item);
  if (!e || e.status !== "completed" || !total || (e.progress || 0) >= total) return false;
  logChange(db, keyOf(item.segment, item.id), total - (e.progress || 0), "complete");
  e.progress = total;
  e.item = freshest(e.item, item);
  entryChanged(keyOf(item.segment, item.id), e); // AniList sync gets the full count too
  await save();
  return true;
}

// How many aired episodes you haven't watched yet (anime only).
export function behindBy(entry) {
  const aired = airedFor(entry.item);
  if (aired == null) return 0;
  const progress = entry.progress || 0;
  return Math.max(0, aired - progress - countIn(skippedOf(entry), progress + 1, aired));
}

// The highest progress allowed: anime can't pass what has aired; manga can't
// pass its chapter count. null = unknown (an ongoing manga: AniList only records
// the chapter count once a series ends), so any number is accepted.
export function maxProgress(item) {
  if (item.unreleased) return 0;
  if (item.segment === "anime") return airedFor(item) ?? totalFor(item);
  return totalFor(item);
}

// For typed input: an error message, or null if n is fine.
export function checkProgress(item, raw) {
  const text = String(raw).trim();
  if (!/^\d+$/.test(text)) return "Enter a whole number.";
  const n = Number(text);
  const max = maxProgress(item);
  if (max == null || n <= max) return null;
  const unit = item.segment === "manga" ? "chapter" : "episode";
  if (item.segment === "anime" && item.nextEpisode) {
    return max === 0 ? "No episodes are out yet." : `Only ${max} ${unit}${max === 1 ? " is" : "s are"} out so far.`;
  }
  return `${item.title} has ${max.toLocaleString()} ${unit}${max === 1 ? "" : "s"}.`;
}

// Sets progress to n (clamped to 0…what's out). Starting a title you had planned,
// paused or dropped moves it to Watching / Reading. Returns
// { progress, status, reachedEnd } — reachedEnd means "ask for the verdict".
export async function setProgress(_user, item, n, source = "plus") {
  const db = await load();
  const key = keyOf(item.segment, item.id);
  const prev = db.library[key];
  const total = totalFor(item);
  const max = maxProgress(item);
  let progress = Math.max(0, Math.floor(Number(n) || 0));
  const was = prev?.progress || 0;
  const skipped = skippedOf(prev);
  // "+1" means the next episode you actually watch: jump over skipped ones
  if (source === "plus" && progress === was + 1) { while (inRanges(skipped, progress)) progress++; }
  if (max != null) progress = Math.min(progress, max);
  let status = prev?.status || null;
  if (progress > (prev?.progress || 0) && (!status || ["plan", "considering", "onhold", "dropped"].includes(status))) status = "watching";
  if (!status) status = "watching";
  // finishing a rewatch: back to Completed, one more rewatch counted, no verdict prompt
  const rewatchDone = status === "rewatching" && !!total && progress >= total;
  if (rewatchDone) status = "completed";
  // the log counts episodes WATCHED: skipped ones in between don't count (stats, streaks, achievements)
  const change = progress >= was ? (progress - was) - countIn(skipped, was + 1, progress) : -((was - progress) - countIn(skipped, progress + 1, was));
  logChange(db, key, change, source);
  logStatus(db, key, prev?.status, status);
  db.library[key] = {
    ...(prev ? {} : { addedAt: new Date().toISOString() }), // when it joined your library (Library → Date added)
    ...prev,
    status,
    progress,
    ...(rewatchDone ? { rewatches: (prev?.rewatches || 0) + 1 } : {}),
    item: freshest(prev?.item, item),
    updatedAt: new Date().toISOString(),
  };
  entryChanged(key, db.library[key]);
  await save();
  return { progress, status, rewatchDone, reachedEnd: !rewatchDone && !!total && progress >= total && status !== "completed" };
}

/* ---------- library sorting (app + website) ---------- */

export const LIBRARY_SORTS = [
  { key: "updated", label: "Recently updated" },
  { key: "watched", label: "Last watched" },
  { key: "added", label: "Date added" },
  { key: "title", label: "Title A–Z" },
  { key: "longest", label: "Longest first" },
  { key: "airing", label: "Airing soonest", anime: true },
  { key: "behind", label: "Most to catch up", anime: true },
];

// How the library grid looks (idea from Mihon): title over the cover,
// title under the cover, covers only, or a list with progress.
export const LIBRARY_LAYOUTS = [
  { key: "compact", label: "Compact grid" },
  { key: "comfortable", label: "Comfortable grid" },
  { key: "cover", label: "Covers only" },
  { key: "list", label: "List" },
];

// When each title was added and last watched, from the saved entry and the
// watch log. Older entries have no addedAt, so their first log line stands in.
export async function getLibraryDates() {
  const db = await load();
  const out = {};
  for (const [time, key, change] of db.log) {
    const d = (out[key] ||= { added: time, watched: 0 });
    if (time < d.added) d.added = time;
    if (change > 0 && time > d.watched) d.watched = time;
  }
  for (const [key, e] of Object.entries(db.library)) {
    const d = (out[key] ||= { added: 0, watched: 0 });
    if (e.addedAt) d.added = Date.parse(e.addedAt);
    const updated = Date.parse(e.updatedAt || 0) || 0;
    if (!d.added) d.added = updated;
    if (!d.watched) d.watched = updated;
  }
  for (const [key, e] of Object.entries(db.cinema)) { // movies and series: added when saved, "watched" when you finished it
    out[key] = { added: e.addedAt || 0, watched: e.status === "completed" ? e.updatedAt || 0 : 0 };
  }
  return out;
}

export function sortEntries(list, sort, dates = {}) {
  const s = [...list];
  const date = (e, k) => dates[keyOf(e.item.segment, e.item.id)]?.[k] || Date.parse(e.updatedAt || 0) || 0;
  if (sort === "title") s.sort((a, b) => a.item.title.localeCompare(b.item.title));
  else if (sort === "airing") {
    const t = (e) => e.item.nextEpisode?.airingAt ?? Infinity;
    s.sort((a, b) => t(a) - t(b));
  } else if (sort === "behind") s.sort((a, b) => behindBy(b) - behindBy(a));
  else if (sort === "added") s.sort((a, b) => date(b, "added") - date(a, "added"));
  else if (sort === "watched") s.sort((a, b) => date(b, "watched") - date(a, "watched"));
  else if (sort === "longest") s.sort((a, b) => (totalFor(b.item) ?? -1) - (totalFor(a.item) ?? -1));
  else s.sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
  return s;
}

/* ---------- bulk actions ---------- */

// keys: ["anime:123", …]. Status changes go through setStatus so sync and
// progress rules apply exactly as if you'd changed them one by one.
export async function bulkSetStatus(keys, status) {
  const db = await load();
  for (const k of keys) {
    const c = db.cinema[k];
    if (c) { // a movie or series: only the statuses its kind has
      if (statusesFor(c.item.segment).some((s) => s.key === status) && (status === "plan" || status === "considering" || !c.item.unreleased)) await setCinemaStatus(c.item, status);
      continue;
    }
    const e = db.library[k];
    // a title that isn't out yet can only be planned or considered
    if (e && (status === "plan" || status === "considering" || !e.item.unreleased)) await setStatus(null, e.item.segment, e.item, status);
  }
}
export async function bulkRemove(keys) {
  const db = await load();
  for (const k of keys) {
    if (db.cinema[k]) { await setCinemaStatus(db.cinema[k].item, null); continue; }
    const e = db.library[k];
    if (e) await setStatus(null, e.item.segment, e.item, null);
  }
}
/* ---------- cinema tracking: movies and live-action TV ---------- */

// Only what the shelf needs of a movie or series, so a backup stays small
const slimCinemaItem = (item) => ({
  id: item.id, segment: item.segment, title: item.title, altTitle: item.altTitle || null,
  image: item.image || null, imageSmall: item.imageSmall || null, banner: item.banner || null,
  genres: item.genres || [], genre: item.genre || null,
  date: item.date || null, dateLabel: item.dateLabel || null, endDate: item.endDate || null,
  creator: item.creator || null, overview: (item.overview || "").slice(0, 400),
  url: item.url || null, format: item.format || null, runtime: item.runtime || null,
  seasons: item.seasons ?? null, finished: item.finished ?? null,
  demo: !!item.demo, unreleased: !!item.unreleased,
});

// every title on the shelf, newest change first
export async function getCinemaShelf() {
  return Object.values((await load()).cinema || {}).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

export async function getCinemaEntry(segment, id) {
  return ((await load()).cinema || {})[keyOf(segment, id)] ?? null;
}

// status: a key from statusesFor(item.segment) (a series has the same ones as Anime),
// or null to remove it from your Library (its verdict goes with it)
export async function setCinemaStatus(item, status) {
  const db = await load();
  db.cinema ||= {};
  const key = keyOf(item.segment, item.id);

  // Only movies and live-action TV belong in cinema storage.
  if (item.segment !== "movie" && item.segment !== "tv") {
    throw new Error(`Unsupported cinema segment: ${item.segment}`);
  }

  if (status === null) {
    const previous = db.cinema[key];
    if (!previous) return;
    logStatus(db, key, previous.status, null);
    delete db.cinema[key]; // its verdict is part of the entry, so it goes too
    delete db.reviews[key];
    delete db.notes[key];
    delete db.excited[key];
    return save();
  }

  if (!statusesFor(item.segment).some((s) => s.key === status)) {
    throw new Error(`Unknown status: ${status}`);
  }
  if (item.unreleased && !["plan", "considering"].includes(status)) return; // not out yet: only planned or considered

  const before = db.cinema[key];
  const now = Date.now();
  logStatus(db, key, before?.status, status);
  db.cinema[key] = {
    item: slimCinemaItem(freshest(before?.item, item)), status, review: before?.review ?? null,
    addedAt: before?.addedAt ?? now, updatedAt: now,
  };
  return save();
}

// Saving a verdict marks it Completed (Watched for a movie). A changed verdict keeps the earlier one in `history`.
export async function saveCinemaReview(item, { verdict, moods, comment }) {
  const db = await load();
  db.cinema ||= {};
  const key = keyOf(item.segment, item.id);
  const before = db.cinema[key];
  const old = before?.review;
  const history = [...(old?.history || [])];
  if (old && old.verdict !== verdict) history.push({ verdict: old.verdict, date: old.date });
  const now = Date.now();
  logStatus(db, key, before?.status, "completed");
  db.cinema[key] = {
    item: slimCinemaItem(item), status: "completed", addedAt: before?.addedAt ?? now, updatedAt: now,
    review: {
      verdict, moods: moods || [], comment: comment || "", date: new Date(now).toISOString(),
      ...(history.length ? { history: history.slice(-10) } : {}),
    },
  };
  return save();
}

// shelf entries that have a verdict (newest first)
export async function getCinemaReviews() {
  return (await getCinemaShelf()).filter((e) => e.review);
}

/* ---------- your shows: next episode + pending, in one list ---------- */

const FOLLOWING = new Set(["watching", "plan", "onhold"]);

// Every anime you follow (Watching, Plan to Watch, On Hold) that has an episode
// coming, or aired episodes you haven't watched (Watching only). Soonest first;
// shows with nothing scheduled but episodes to catch up on go last (only for
// two weeks after the final episode, then they move to youreWatching).
//   fresh: { id -> item } from fetchNextEpisodes (newer air times than the saved copy)
export function yourShows(lib, fresh = {}, now = Date.now()) {
  const nowS = now / 1000;
  return Object.values(lib)
    .filter((e) => e.item.segment === "anime" && FOLLOWING.has(e.status))
    .map((e) => {
      const item = { ...e.item, ...(fresh[e.item.id] || {}) };
      const entry = { ...e, item };
      const next = item.nextEpisode && item.nextEpisode.airingAt > nowS ? item.nextEpisode : null;
      return {
        entry, item, next,
        pending: e.status === "watching" ? behindBy(entry) : 0,
        delay: e.delay && e.delay.episode === item.nextEpisode?.episode ? e.delay : null,
      };
    })
    // finished airing more than 2 weeks ago: not a Schedule show any more, it
    // lives in More > You're watching (see youreWatching)
    .filter((x) => x.next || (x.pending > 0 && !pastWrapUp(x.item, now)))
    .sort(scheduleOrder);
}

// More > You're watching: finished shows you are watching again, or catching up
// on after the two weeks on Schedule are over. Rewatching always lands here.
// Most recently touched first. Finishing one moves it to Completed as usual.
export function youreWatching(lib, now = Date.now()) {
  return Object.values(lib)
    .filter((e) => e.item.segment === "anime"
      && (e.status === "rewatching" || (e.status === "watching" && pastWrapUp(e.item, now))))
    .sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
}

// Schedule's order: by the weekday the next episode airs, Sunday → Saturday.
// Within one day, shows with episodes to catch up on come first (fewest
// pending first), then the caught-up ones; ties go by time of day.
//   Sun · 1 pending, Sun · caught up, Mon · caught up, Tue · 3 pending, Tue · caught up
// Shows with nothing scheduled (finished airing, you're still behind) go last.
const weekDay = (next) => (next ? new Date(next.airingAt * 1000).getDay() : 7);
const dayMinute = (next) => {
  if (!next) return Infinity;
  const d = new Date(next.airingAt * 1000);
  return d.getHours() * 60 + d.getMinutes();
};
export function scheduleOrder(a, b) {
  const day = weekDay(a.next) - weekDay(b.next);
  if (day) return day;
  const pa = a.pending > 0 ? a.pending : Infinity;
  const pb = b.pending > 0 ? b.pending : Infinity;
  if (pa !== pb) return pa - pb;
  return dayMinute(a.next) - dayMinute(b.next) || (a.next?.airingAt ?? Infinity) - (b.next?.airingAt ?? Infinity);
}

/* ---------- pending: aired but not watched yet ---------- */

// Your Watching anime that are airing now or that you're behind on, with how
// many aired episodes you haven't watched. Sunday's episodes add to it; each
// +1 takes one off. { total, items: [{ entry, pending }] }, most pending first,
// then soonest next episode.
export async function getPending() {
  const entries = Object.values((await load()).library)
    .filter((e) => e.item.segment === "anime" && e.status === "watching");
  const items = entries
    .map((e) => ({ entry: e, pending: behindBy(e) }))
    .filter(({ entry, pending }) => (pending > 0 && !pastWrapUp(entry.item)) || (entry.item.nextEpisode && !entry.item.finished))
    .sort((a, b) => b.pending - a.pending
      || (a.entry.item.nextEpisode?.airingAt ?? Infinity) - (b.entry.item.nextEpisode?.airingAt ?? Infinity));
  return { total: items.reduce((n, x) => n + x.pending, 0), items };
}

/* ---------- delays: "Episode 8 moved from Wed to next Wed" ---------- */

const HOUR = 3600;
// Call with fresh AniList data ({ id -> item }). Compares each followed
// anime's next episode with the time saved last time: the same episode airing
// more than an hour later = delayed. Also keeps the saved snapshots current.
export async function noteAiring(fresh) {
  const db = await load();
  let changed = false;
  Object.values(db.library).forEach((e) => {
    const f = e.item.segment === "anime" && fresh[e.item.id];
    if (!f) return;
    const before = e.item.nextEpisode;
    const now = f.nextEpisode || null;
    if (before && now && before.episode === now.episode && now.airingAt - before.airingAt > HOUR) {
      // keep the ORIGINAL date if it slips twice
      const from = e.delay?.episode === now.episode ? e.delay.from : before.airingAt;
      e.delay = { episode: now.episode, from, to: now.airingAt };
      changed = true;
    } else if (e.delay && (!now || now.episode !== e.delay.episode)) {
      delete e.delay; // that episode aired; the next one is on its own schedule
      changed = true;
    }
    if (JSON.stringify(before) !== JSON.stringify(now) || e.item.finished !== f.finished || !!e.item.unreleased !== !!f.unreleased || (f.endDate ?? null) !== (e.item.endDate ?? null)) {
      e.item = { ...e.item, nextEpisode: now, finished: f.finished, unreleased: f.unreleased, episodes: f.episodes ?? e.item.episodes, endDate: f.endDate ?? null };
      changed = true;
    }
  });
  if (changed) await save();
  return changed;
}

/* ---------- import from AniList ---------- */

// Sync pull: apply AniList's list to the library.
//   remote: [{ status, progress, updatedAt, item }]  (your whole AniList list)
//   skip:   keys with changes of yours still waiting to be sent (yours win)
//   removed: keys AniList had last time but not now (you deleted them there)
// Newest change wins, like the import. Verdicts and the log are untouched.
export async function applyAniListPull(remote, { skip = new Set(), removed = [] } = {}) {
  const db = await load();
  const result = { added: 0, updated: 0, removed: 0, oursNewer: [] };
  remote.forEach((a) => {
    const status = ANILIST_STATUS[a.status];
    const key = keyOf(a.item.segment, a.item.id);
    if (!status || skip.has(key)) return;
    const prev = db.library[key];
    const theirs = new Date((a.updatedAt || 0) * 1000).toISOString();
    const same = prev && prev.status === status && (prev.progress || 0) === (a.progress || 0);
    if (same) return;
    if (prev && prev.updatedAt >= theirs) { result.oursNewer.push(key); return; } // ours is newer: sync sends it up
    db.library[key] = { ...prev, status, progress: a.progress || 0, item: freshest(prev?.item, a.item), updatedAt: theirs };
    result[prev ? "updated" : "added"]++;
  });
  removed.forEach((key) => {
    if (skip.has(key) || !db.library[key]) return;
    delete db.library[key];
    result.removed++;
  });
  if (result.added || result.updated || result.removed) await save();
  return result;
}

const ANILIST_STATUS = {
  CURRENT: "watching", REPEATING: "rewatching", PLANNING: "plan",
  COMPLETED: "completed", PAUSED: "onhold", DROPPED: "dropped",
};

// entries: [{ status, progress, updatedAt (unix s), item }] from fetchAniListUserList.
// A title already in VoidPop keeps whichever copy was changed more recently.
// Verdicts are never touched (AniList scores are numbers; VoidPop has none).
export async function importAniListEntries(entries) {
  const db = await load();
  const result = { added: 0, updated: 0, kept: 0 };
  entries.forEach((a) => {
    const status = ANILIST_STATUS[a.status];
    if (!status) return;
    const key = keyOf(a.item.segment, a.item.id);
    const prev = db.library[key];
    const theirs = new Date((a.updatedAt || 0) * 1000).toISOString();
    if (prev && prev.updatedAt >= theirs) { result.kept++; return; }
    db.library[key] = {
      ...prev,
      status,
      progress: a.progress || 0,
      item: freshest(prev?.item, a.item),
      updatedAt: theirs,
    };
    result[prev ? "updated" : "added"]++;
  });
  if (result.added || result.updated) await save();
  return result;
}

// entries: [{ item, status, progress, times }] from a MyAnimeList export.
// Titles already in VoidPop are left as they are (your copy wins); new ones
// are added. times = how many times you finished it on MAL (rewatches).
export async function importMalEntries(entries) {
  const db = await load();
  const result = { added: 0, kept: 0 };
  const now = new Date().toISOString();
  entries.forEach(({ item, status, progress, times }) => {
    const key = keyOf(item.segment, item.id);
    if (db.library[key]) { result.kept++; return; }
    const total = totalFor(item);
    db.library[key] = {
      status,
      progress: status === "completed" && total ? total : progress || 0,
      ...(times > 0 ? { rewatches: times } : {}),
      item,
      updatedAt: now,
    };
    entryChanged(key, db.library[key]); // AniList sync (if on) gets them too
    result.added++;
  });
  if (result.added) await save();
  return result;
}

export async function getStats() {
  const entries = Object.values((await load()).library);
  const seen = Object.values((await load()).cinema || {}).filter((e) => isDone(e.status)); // movies and TV you have watched (their shelf is apart from the Library)
  const sum = (seg) => entries.filter((e) => (e.item.segment === "manga") === (seg === "manga")).reduce((n, e) => n + (seg === "manga" ? e.progress || 0 : watchedOf(e)), 0);
  const completed = entries.filter((e) => isDone(e.status)); // rewatching still counts as finished
  const by = (kind) => completed.filter((e) => kindOf(e.item) === kind).length;
  // per list, per status: { anime: { watching: 3, completed: 9, … }, manga: {…} }
  const byStatus = { anime: {}, manga: {} };
  entries.forEach((e) => {
    const seg = e.item.segment === "manga" ? "manga" : "anime";
    byStatus[seg][e.status] = (byStatus[seg][e.status] || 0) + 1;
  });
  return {
    // Content consumed: what the ranks count. Everything finished, of every kind, so a movie counts as much as a manga.
    totalCompleted: completed.length + seen.length,
    anime: by("anime"),
    manga: by("manga"),
    novel: by("novel"),
    movie: seen.filter((e) => e.item.segment === "movie").length,
    tv: seen.filter((e) => e.item.segment === "tv").length,
    tracking: entries.length,
    episodesWatched: sum("anime"),
    chaptersRead: sum("manga"),
    // Statistics (Mihon-style): totals count every known episode/chapter of
    // your entries (a title without a known length counts what you've marked)
    episodesTotal: entries.filter((e) => e.item.segment !== "manga").reduce((n, e) => n + Math.max(totalFor(e.item) || 0, e.progress || 0), 0),
    chaptersTotal: entries.filter((e) => e.item.segment === "manga").reduce((n, e) => n + Math.max(totalFor(e.item) || 0, e.progress || 0), 0),
    minutesWatched: entries.filter((e) => e.item.segment !== "manga").reduce((n, e) => n + watchedOf(e) * (e.item.duration || 24), 0),
    inLibrary: { anime: entries.filter((e) => e.item.segment !== "manga").length, manga: entries.filter((e) => e.item.segment === "manga").length },
    byStatus,
    verdicts: Object.keys((await load()).reviews).length,
    excited: Object.keys((await load()).excited).length,
  };
}

/* ---------- library lists: watching and reading are different ---------- */

export const LIBRARY_LISTS = [
  { key: "watch", label: "Watch list", hint: "Anime · Donghua · Korean animation", segment: "anime" },
  { key: "read", label: "Read list", hint: "Manga · Manhwa · Manhua · Novels", segment: "manga" },
];
export const inLibraryList = (entry, list) =>
  list === "read" ? entry.item.segment === "manga" : entry.item.segment !== "manga";

// Library kinds: Anime, Manga (manga, manhwa, manhua) and Novels (light and
// web novels). Novels are "manga" to AniList; their format says NOVEL.
export const LIBRARY_KINDS = [
  { key: "anime", label: "Anime", hint: "Japanese, Chinese and Korean animation", segment: "anime" },
  { key: "manga", label: "Manga", hint: "Manga, manhwa and manhua", segment: "manga" },
  { key: "novel", label: "Novels", hint: "Light novels and web novels", segment: "manga" },
  { key: "movie", label: "Movies", hint: "Live-action films", segment: "movie" },
  { key: "tv", label: "TV", hint: "Live-action series", segment: "tv" },
];
export function kindOf(item) {
  if (item.segment === "movie" || item.segment === "tv") return item.segment;
  if (item.segment !== "manga") return "anime";
  return item.format === "NOVEL" ? "novel" : "manga";
}
export const kindLabel = (item) => LIBRARY_KINDS.find((k) => k.key === kindOf(item))?.label;
// the three library headings: Manga covers manga, manhwa and manhua; Novel covers light and web novels
const KIND_NAME = { anime: "Anime", manga: "Manga", novel: "Novel", movie: "Movie", tv: "TV" };

// keys of library manga that don't know their format yet (so a novel
// can't be told apart from a manga)
export async function kindsMissing() {
  const db = await load();
  return Object.keys(db.library).filter((k) => db.library[k].item.segment === "manga" && !db.library[k].item.format);
}
// fills in format (and country) from fetchKinds; returns how many changed
export async function fillKinds(found) {
  const db = await load();
  let n = 0;
  for (const [key, f] of Object.entries(found)) {
    const e = db.library[key];
    if (!e || !f.format || e.item.format) continue;
    e.item = { ...e.item, format: f.format, country: e.item.country || f.country };
    n++;
  }
  if (n) await save();
  return n;
}

/* ---------- tiers ---------- */

// Ranks, by Content consumed: everything you have finished, whatever it is (anime, manga, novels, movies
// and TV). The gaps start at 60 and grow, so each rank takes longer than the last.
export const TIERS = [
  { key: "newbie", label: "Newbie", min: 1, color: "#9ca3af",
    title: "You are a Newbie", message: "Welcome to VoidPop. Finish anime, manga, novels, movies and TV to climb the ranks." },
  { key: "rookie", label: "Rookie", min: 5, color: "#60a5fa",
    title: "You are a Rookie", message: "5 titles consumed. You've started something." },
  { key: "amateur", label: "Amateur", min: 10, color: "#38bdf8",
    title: "You are an Amateur", message: "10 titles consumed. It's becoming a habit." },
  { key: "collector", label: "Collector", min: 25, color: "#22d3ee",
    title: "You are a Collector", message: "25 titles consumed. That's the start of a proper collection." },
  { key: "critic", label: "Critic", min: 60, color: "#2dd4bf",
    title: "You are a Critic", message: "60 titles consumed. Your verdicts carry weight now." },
  { key: "seasonkeeper", label: "Season Keeper", min: 130, color: "#34d399",
    title: "You are a Season Keeper", message: "130 titles consumed. You keep up with every season." },
  { key: "seasonmaster", label: "Season Master", min: 210, color: "#10b981",
    title: "You are a Season Master", message: "210 titles consumed. Seasons answer to you now." },
  { key: "relentless", label: "Relentless Watcher", min: 300, color: "#a3e635",
    title: "You are a Relentless Watcher", message: "300 titles consumed. Nothing slows you down." },
  { key: "champion", label: "Champion", min: 490, color: "#facc15",
    title: "You are a Champion", message: "490 titles consumed. Very few get this far." },
  { key: "elite", label: "Elite", min: 700, color: "#f59e0b",
    title: "You are Elite", message: "700 titles consumed. People ask you what to watch." },
  { key: "legend", label: "Legend", min: 1000, color: "#fb923c",
    title: "You are a Legend", message: "1,000 titles consumed. A thousand stories, and counting." },
  { key: "mythic", label: "Mythic", min: 1500, color: "#f43f5e",
    title: "You are Mythic", message: "1,500 titles consumed. They tell stories about you now." },
  { key: "unrivalled", label: "Unrivalled", min: 2000, color: "#ec4899",
    title: "You are Unrivalled", message: "2,000 titles consumed. No one is close." },
  { key: "godly", label: "Godly", min: 3000, color: "#e879f9",
    title: "You are Godly", message: "3,000 titles consumed. This is beyond human." },
  { key: "addicted", label: "Addicted", min: 3500, color: "#a855f7",
    title: "You have become an Addict", message: "3,500 titles consumed. Seriously: take a break, drink some water, go outside." },
];

// Before your first finished title you have no rank at all: Newbie is earned, not given. (It is not in TIERS, so
// it never counts as a rank collected and is never celebrated.)
export const UNRANKED = { key: "unranked", label: "Unranked", min: 0, color: "#6b7280",
  title: "You have no rank yet", message: "Finish your first title to become a Newbie." };
export const tierFor = (n) => [...TIERS].reverse().find((t) => n >= t.min) || UNRANKED;

export async function getUserTier() {
  const stats = await getStats();
  return { tier: tierFor(stats.totalCompleted), stats };
}

// Ranks collected, for the Rank Collector achievement: 1 = Newbie … 15 = Addicted.
// It counts the highest rank you have reached, including one you were shown and
// then dropped below by removing titles, so a collected rank is never lost.
export async function getRanksCollected() {
  const db = await load();
  const { tier } = await getUserTier();
  const now = TIERS.findIndex((t) => t.key === tier.key);
  return Math.max(now, seenTierIndex(db.meta)) + 1;
}

// Rank-up celebrations: the highest rank you've already been shown. A new,
// higher rank → celebrate once. Dropping a rank (removing titles) never
// celebrates again when you climb back.
// The ranks changed on 30 Sep 2026 (7 became 15, and some names moved).
// A rank "seen" under the old list is matched to the new list by the titles
// it needed, so nobody is re-celebrated for ranks they'd passed, and nobody
// skips a celebration for a new rank they haven't reached yet.
const OLD_TIER_MIN = { rookie: 0, explorer: 60, collector: 130, critic: 210, elite: 300, legend: 400, addicted: 520 };
export function seenTierIndex(meta) {
  if (!meta?.tierSeen) return -1;
  if (meta.tierSeenV === 2) return TIERS.findIndex((t) => t.key === meta.tierSeen);
  const min = OLD_TIER_MIN[meta.tierSeen] ?? 0;
  return TIERS.reduce((best, t, i) => (t.min <= min ? i : best), 0);
}

export async function checkRankUp() {
  const db = await load();
  const { tier } = await getUserTier();
  const seenIndex = seenTierIndex(db.meta);
  const nowIndex = TIERS.findIndex((t) => t.key === tier.key);
  return nowIndex > seenIndex ? tier : null;
}
// "Your badge" page: replay a rank's celebration on demand.
const celebrateListeners = new Set();
export function onCelebrate(fn) { celebrateListeners.add(fn); return () => celebrateListeners.delete(fn); }
export function celebrate(tier) { celebrateListeners.forEach((fn) => { try { fn(tier); } catch { /* ignore */ } }); }

export async function markRankSeen(key) {
  const db = await load();
  const seenIndex = seenTierIndex(db.meta);
  if (TIERS.findIndex((t) => t.key === key) <= seenIndex) return;
  db.meta = { ...(db.meta || {}), tierSeen: key, tierSeenV: 2 };
  await save();
}

/* ---------- your verdicts & vibes ---------- */

export const VERDICTS = [
  { key: "peak", label: "Peak", color: "#a855f7" },
  { key: "divein", label: "Dive In", color: "#10b981" },
  { key: "onetime", label: "One Time", color: "#f59e0b" },
  { key: "voidit", label: "Void It", color: "#f43f5e" },
];

export const VIBES = [
  "Action", "Comedy", "Emotional", "Romance", "Mystery",
  "Thriller", "Horror", "Slice of Life", "Dark", "Wholesome",
];

// Moods: how it made you FEEL (vibes are what KIND of show it was). Up to 3.
// Each Void Verdict asks for its own five, so the choices match the verdict.
export const MOODS_BY_VERDICT = {
  peak: [
    "Made me forget the world.",
    "Made me feel alive.",
    "Made me question reality.",
    "Made me believe in stories.",
    "Made me feel something indescribable.",
  ],
  divein: [
    "Made me crave more.",
    "Made me lose track of time.",
    "Made me obsessed.",
    "Made me forget to sleep.",
    "Made me fall into its world.",
  ],
  onetime: [
    "Made me pass the time.",
    "Made me mildly entertained.",
    "Made me kill some time.",
    "Made me watch without thinking.",
    `Made me say, "That was okay."`,
  ],
  voidit: [
    "Wasted my time.",
    "Made me lose interest.",
    "Made me wish I'd watched something else.",
    "Made me check how many episodes were left.",
    "Made me wonder how it got made.",
  ],
};
// the five moods for one verdict key ("peak", "divein", "onetime", "voidit")
export const moodsFor = (verdict) => MOODS_BY_VERDICT[verdict] || [];
// every mood there is (reviews saved with older moods, like "Made me laugh", still show as they are)
export const MOODS = Object.values(MOODS_BY_VERDICT).flat();

// Your verdict is never silently rewritten: when you change it, the earlier one
// is kept in `history` ([{ verdict, date }], oldest first, up to 10).
export async function addReview(_user, segment, id, { verdict, vibes, moods, comment }) {
  const db = await load();
  const key = keyOf(segment, id);
  const before = db.reviews[key];
  const history = [...(before?.history || [])];
  if (before && before.verdict !== verdict) history.push({ verdict: before.verdict, date: before.date });
  db.reviews[key] = {
    segment, titleId: id, verdict, vibes: vibes || [], moods: moods || [], comment: comment || "",
    date: new Date().toISOString(),
    ...(history.length ? { history: history.slice(-10) } : {}),
  };
  return save();
}

// every verdict you've given: [{ segment, titleId, verdict, vibes, comment, date }]
export async function getReviews() {
  return Object.values((await load()).reviews);
}

export async function getMyReview(_user, segment, id) {
  return (await load()).reviews[keyOf(segment, id)] ?? null;
}

/* ---------- first-run welcome ---------- */
// The welcome screens show once. More > Help can show them again.
export async function isOnboarded() {
  return !!(await load()).meta?.onboarded;
}
export async function setOnboarded(done = true) {
  const db = await load();
  db.meta = { ...(db.meta || {}), onboarded: done ? new Date().toISOString() : null };
  await save();
}

/* ---------- personal notes (legacy) ---------- */
// Notes are no longer written anywhere in the UI (comments replaced them), but notes you already
// saved are kept and still appear in the Markdown export. One private note per title, any title (in your library or not). Kept in
// backups; never synced to AniList.

export async function getNote(segment, id) {
  return (await load()).notes?.[keyOf(segment, id)]?.text || "";
}
export async function setNote(segment, id, text) {
  const db = await load();
  db.notes = db.notes || {};
  const key = keyOf(segment, id);
  const t = String(text || "").trim().slice(0, 2000);
  if (t) db.notes[key] = { text: t, at: new Date().toISOString() };
  else delete db.notes[key];
  await save();
  return t;
}

/* ---------- excited (upcoming titles you're waiting for) ---------- */

export async function getExcited() {
  return { ...(await load()).excited };
}

export async function toggleExcited(_user, item) {
  const db = await load();
  const key = keyOf(item.segment, item.id);
  if (db.excited[key]) {
    delete db.excited[key];
    await save();
    return false;
  }
  db.excited[key] = {
    item: { id: item.id, segment: item.segment, title: item.title, image: item.image, date: item.date },
    at: new Date().toISOString(),
  };
  await save();
  return true;
}

/* ---------- settings ---------- */

export async function getSettings() {
  return { ...(await load()).settings };
}

export async function setSetting(key, value) {
  const db = await load();
  db.settings = { ...db.settings, [key]: value };
  await save();
  return { ...db.settings };
}

/* ---------- backup: the only copy is on this device ---------- */

export async function exportData() {
  const db = await load();
  // "app" says "voidpop" now; backups made before the rename say "voidation" and still restore
  return JSON.stringify({ app: "voidpop", version: 1, exportedAt: new Date().toISOString(), ...db }, null, 2);
}

// Replaces everything with the backup. Returns an error message, or null on success.
export async function importData(json) {
  let data;
  try {
    data = JSON.parse(json);
  } catch {
    return "That file isn't a VoidPop backup.";
  }
  if (!["voidpop", "voidation"].includes(data?.app) || typeof data.library !== "object") return "That file isn't a VoidPop backup.";
  cache = {
    library: data.library || {}, reviews: data.reviews || {}, excited: data.excited || {},
    cinema: renameWatched(data.cinema && typeof data.cinema === "object" ? data.cinema : {}), // backups made before Movies & TV have none
    notes: data.notes && typeof data.notes === "object" ? data.notes : {}, // an old backup has none; removing a title deletes its note, so it must exist
    log: Array.isArray(data.log) ? data.log : [],
    categories: Array.isArray(data.categories) ? data.categories : [],
    meta: data.meta && typeof data.meta === "object" ? data.meta : {},
    settings: { ...DEFAULT_SETTINGS, ...(data.settings || {}) },
  };
  await save();
  return null;
}

// Export → Library list: every title as a spreadsheet-friendly CSV
// (Type, Title, Status, Progress, Total, Verdict, link).
export async function exportLibraryCsv() {
  const db = await load();
  const cell = (v) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const rows = Object.entries(db.library)
    .sort((a, b) => a[1].item.title.localeCompare(b[1].item.title))
    .map(([key, e]) => {
      const seg = e.item.segment;
      const label = statusesFor(seg).find((s) => s.key === e.status)?.label || e.status;
      const verdict = VERDICTS.find((v) => v.key === db.reviews[key]?.verdict)?.label || "";
      return [KIND_NAME[kindOf(e.item)], e.item.title, label, e.progress || 0, totalFor(e.item) ?? "",
        verdict, e.item.url || ""].map(cell).join(",");
    });
  // Movies & TV: no progress or total
  const cinemaRows = Object.values(db.cinema || {})
    .sort((a, b) => a.item.title.localeCompare(b.item.title))
    .map((e) => [e.item.segment === "tv" ? "Series" : "Movie", e.item.title,
      statusesFor(e.item.segment).find((x) => x.key === e.status)?.label || e.status, "", "",
      VERDICTS.find((v) => v.key === e.review?.verdict)?.label || "", e.item.url || ""].map(cell).join(","));
  return ["Type,Title,Status,Progress,Total,Verdict,Link", ...rows, ...cinemaRows].join("\n") + "\n";
}

// Export → Notes (Markdown): every title as a section with its status, verdict,
// vibes and your private note. Plain text, so it drops straight into Obsidian or
// any notes app.
export async function exportLibraryMarkdown() {
  const db = await load();
  const entries = Object.entries(db.library).sort((a, b) => a[1].item.title.localeCompare(b[1].item.title));
  const out = ["# VoidPop library", "", `${entries.length} titles, exported ${new Date().toISOString().slice(0, 10)}.`, ""];
  for (const [key, e] of entries) {
    const seg = e.item.segment;
    const status = statusesFor(seg).find((s) => s.key === e.status)?.label || e.status;
    const review = db.reviews[key];
    const verdict = VERDICTS.find((v) => v.key === review?.verdict)?.label;
    const total = totalFor(e.item);
    out.push(`## ${e.item.title}`, "", `- Type: ${KIND_NAME[kindOf(e.item)]}`, `- Status: ${status}`,
      `- Progress: ${e.progress || 0}${total != null ? ` of ${total}` : ""}`);
    if (verdict) out.push(`- Void Verdict: ${verdict}`);
    if (review?.vibes?.length) out.push(`- Vibes: ${review.vibes.join(", ")}`);
    const note = db.notes?.[key]?.text;
    if (note) out.push("", ...note.split("\n").map((line) => `> ${line}`));
    out.push("");
  }
  return out.join("\n");
}

// Size of everything VoidPop has saved, in bytes (Data & storage).
export async function storageSize() {
  return JSON.stringify(await load()).length;
}

// Wipe the library, verdicts and Excited list. Settings stay.
// Bring a backup INTO this phone's library without losing anything on either side (importData replaces instead).
// Every title, verdict, note and so on from both is kept; when both have the same one, the more recently changed wins.
// Settings and flags stay as they are on this phone. A title you removed here that still sits in the backup comes
// back (nothing records removals), which is the safe direction for "combine".
// → { added: titles that were only in the backup } or { error }
const stampOf = (v) => { const t = typeof v === "number" ? v : Date.parse(v || ""); return Number.isFinite(t) ? t : 0; };
export async function mergeData(json) {
  let data;
  try { data = JSON.parse(json); } catch { return { error: "That isn't a VoidPop backup." }; }
  if (!["voidpop", "voidation"].includes(data?.app) || !data.library || typeof data.library !== "object") return { error: "That isn't a VoidPop backup." };
  const db = await load();
  db.cinema ||= {};
  const take = (mine, theirs, when) => {
    let n = 0;
    for (const [k, v] of Object.entries(theirs && typeof theirs === "object" ? theirs : {})) {
      if (!v || typeof v !== "object") continue;
      if (!(k in mine)) { mine[k] = v; n += 1; } else if (when(v) > when(mine[k])) mine[k] = v;
    }
    return n;
  };
  const cinema = renameWatched(data.cinema && typeof data.cinema === "object" ? data.cinema : {});
  const added = take(db.library, data.library, (e) => stampOf(e.updatedAt)) + take(db.cinema, cinema, (e) => stampOf(e.updatedAt));
  take(db.reviews, data.reviews, (r) => stampOf(r.date));
  take(db.excited, data.excited, (x) => stampOf(x.at));
  take(db.notes, data.notes, (x) => stampOf(x.at));
  if (Array.isArray(data.log)) { // both histories, each entry once, oldest first
    const seen = new Set(db.log.map((e) => JSON.stringify(e)));
    for (const e of data.log) if (Array.isArray(e) && !seen.has(JSON.stringify(e))) db.log.push(e);
    db.log.sort((a, b) => (a[0] || 0) - (b[0] || 0));
  }
  if (!db.categories.length && Array.isArray(data.categories)) db.categories = data.categories;
  db.meta = { ...(data.meta && typeof data.meta === "object" ? data.meta : {}), ...db.meta }; // this phone's flags win (e.g. already onboarded)
  await save();
  return { added };
}

export async function clearData() {
  const db = await load();
  cache = { ...EMPTY(), settings: db.settings };
  await save();
}

/* ---------- helpers ---------- */

export function timeAgo(iso) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hr ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d} day${d > 1 ? "s" : ""} ago`;
  const mo = Math.floor(d / 30);
  return `${mo} month${mo > 1 ? "s" : ""} ago`;
}

/* ---------- Excited → Watching ---------- */
// Excited is for anime that aren't out yet. The moment one comes out (AniList
// marks it airing or finished), it moves to Watching by itself, so its episodes
// count in Pending and its countdown shows in Your watch. Titles you'd already
// put in Plan to Watch move too; any other status you chose is left alone.
// fetchFresh(ids) → { id: item } with current AniList data.
export async function promoteExcited(fetchFresh) {
  const db = await load();
  const keys = Object.keys(db.excited).filter((k) => k.startsWith("anime:") && !db.excited[k].promoted);
  if (!keys.length) return [];
  const fresh = await fetchFresh(keys.map((k) => Number(k.slice(6))));
  const moved = [];
  for (const k of keys) {
    const item = fresh[k.slice(6)];
    if (!item || item.unreleased) continue;
    const status = db.library[k]?.status;
    if (!status || status === "plan") {
      await setStatus(null, "anime", item, "watching");
      moved.push(item);
    }
    // done either way: it's out, so it won't be checked again
    db.excited[k] = { ...db.excited[k], promoted: new Date().toISOString() };
  }
  await save();
  return moved;
}
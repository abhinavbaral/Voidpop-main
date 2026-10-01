// Voidation data layer. Shared by the app AND the website: every screen talks
// ONLY to these functions, so both clients keep the same data in the same shape.
//
// There are no accounts. Everything lives in one JSON document on this device
// (see storage.js):
//   library  {"segment:id" -> { status, progress, cats, item snapshot, updatedAt, addedAt?, delay? }}
//   categories [{ id, name }]  your own groups, like Mihon's ("Favourites", "Rewatch"…)
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

const DB_KEY = "voidation:db:v1";
// notifyEpisodes only matters in the app (the website can't schedule alerts)
// logo: which logo the app shows (see Brand.js): "classic", "voidmon" or "peeking"
export const DEFAULT_SETTINGS = { clock24: false, posterBadges: true, notifyEpisodes: true, seasonLayout: "grid", logo: "classic", libraryLayout: "compact" };
const EMPTY = () => ({ library: {}, reviews: {}, excited: {}, notes: {}, log: [], categories: [], meta: {}, settings: { ...DEFAULT_SETTINGS } });

let cache = null;
let writing = Promise.resolve();

async function load() {
  if (cache) return cache;
  try {
    const raw = await readKey(DB_KEY);
    const saved = raw ? JSON.parse(raw) : {};
    cache = { ...EMPTY(), ...saved, log: Array.isArray(saved.log) ? saved.log : [],
      categories: Array.isArray(saved.categories) ? saved.categories : [], settings: { ...DEFAULT_SETTINGS, ...(saved.settings || {}) } };
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
  const reading = segment === "manga";
  return [
    { key: "watching", label: reading ? "Reading" : "Watching" },
    { key: "completed", label: reading ? "Finished" : "Completed" },
    { key: "rewatching", label: reading ? "Rereading" : "Rewatching" },
    { key: "plan", label: reading ? "Plan to Read" : "Plan to Watch" },
    { key: "onhold", label: "On Hold" },
    { key: "dropped", label: "Dropped" },
  ];
}

// Not out yet: you can only plan it (and mark Excited). Watching, Completed,
// On Hold, Dropped, progress and verdicts open once it starts airing.
export function statusesAllowed(item) {
  const all = statusesFor(item.segment);
  return item.unreleased ? all.filter((s) => s.key === "plan") : all;
}

export async function getLibrary() {
  const db = await load();
  return { ...db.library };
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
  return next.partial && !prev.partial ? { ...prev, ...pick(next, ["nextEpisode", "finished", "episodes", "chapters"]) } : next;
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
// Library badge: episodes (or chapters) that are out and you haven't watched.
// 24-episode show, 23 out, watched 3 → 20. Watched all 23 → 0 (no badge).
// Completed → 0. Ongoing manga (no known chapter count) → null (no badge).
export function leftToWatch(entry) {
  if (entry.status === "completed") return 0;
  const item = entry.item;
  const out = item.segment === "anime" ? airedFor(item) ?? totalFor(item) : totalFor(item);
  if (out == null) return null;
  return Math.max(0, out - (entry.progress || 0));
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
  return aired == null ? 0 : Math.max(0, aired - (entry.progress || 0));
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
  if (max != null) progress = Math.min(progress, max);
  let status = prev?.status || null;
  if (progress > (prev?.progress || 0) && (!status || ["plan", "onhold", "dropped"].includes(status))) status = "watching";
  if (!status) status = "watching";
  // finishing a rewatch: back to Completed, one more rewatch counted, no verdict prompt
  const rewatchDone = status === "rewatching" && !!total && progress >= total;
  if (rewatchDone) status = "completed";
  logChange(db, key, progress - (prev?.progress || 0), source);
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

/* ---------- categories (your own groups) and bulk actions ---------- */

export async function getCategories() {
  return [...(await load()).categories];
}

export async function addCategory(name) {
  const db = await load();
  const clean = String(name || "").trim().slice(0, 40);
  if (!clean) return null;
  if (db.categories.some((c) => c.name.toLowerCase() === clean.toLowerCase())) return null;
  const cat = { id: `c${Date.now().toString(36)}`, name: clean };
  db.categories = [...db.categories, cat];
  await save();
  return cat;
}

export async function renameCategory(id, name) {
  const db = await load();
  const clean = String(name || "").trim().slice(0, 40);
  if (!clean) return;
  db.categories = db.categories.map((c) => (c.id === id ? { ...c, name: clean } : c));
  await save();
}

export async function moveCategory(id, by) {
  const db = await load();
  const i = db.categories.findIndex((c) => c.id === id);
  const j = i + by;
  if (i < 0 || j < 0 || j >= db.categories.length) return;
  const list = [...db.categories];
  [list[i], list[j]] = [list[j], list[i]];
  db.categories = list;
  await save();
}

// Deleting a category never deletes titles; they just leave that category.
export async function deleteCategory(id) {
  const db = await load();
  db.categories = db.categories.filter((c) => c.id !== id);
  Object.values(db.library).forEach((e) => { if (e.cats?.includes(id)) e.cats = e.cats.filter((c) => c !== id); });
  await save();
}

export async function setEntryCategories(segment, id, cats) {
  const db = await load();
  const e = db.library[keyOf(segment, id)];
  if (!e) return;
  e.cats = [...new Set(cats)];
  await save();
}

// keys: ["anime:123", …]. Status changes go through setStatus so sync and
// progress rules apply exactly as if you'd changed them one by one.
export async function bulkSetStatus(keys, status) {
  const db = await load();
  for (const k of keys) {
    const e = db.library[k];
    // a title that isn't out yet can only be planned
    if (e && (status === "plan" || !e.item.unreleased)) await setStatus(null, e.item.segment, e.item, status);
  }
}
export async function bulkCategory(keys, catId, add) {
  const db = await load();
  keys.forEach((k) => {
    const e = db.library[k];
    if (!e) return;
    const cats = new Set(e.cats || []);
    if (add) cats.add(catId); else cats.delete(catId);
    e.cats = [...cats];
  });
  await save();
}
export async function bulkRemove(keys) {
  const db = await load();
  for (const k of keys) {
    const e = db.library[k];
    if (e) await setStatus(null, e.item.segment, e.item, null);
  }
}

/* ---------- your shows: next episode + pending, in one list ---------- */

const FOLLOWING = new Set(["watching", "plan", "onhold"]);

// Every anime you follow (Watching, Plan to Watch, On Hold) that has an episode
// coming, or aired episodes you haven't watched (Watching only). Soonest first;
// shows with nothing scheduled but episodes to catch up on go last.
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
    .filter((x) => x.next || x.pending > 0)
    .sort(scheduleOrder);
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

/* ---------- Categories: a reward for 500+ completed anime ---------- */
// Categories unlock at 500 completed anime. Each one you make becomes a row at
// the top of Explore during the third week of every month (days 15–21).

export const CATEGORY_MIN = 500;
export const SPOTLIGHT_MIN = CATEGORY_MIN; // older name
export const spotlightWeek = (date = new Date()) => date.getDate() >= 15 && date.getDate() <= 21;

export async function getCategoryAccess() {
  const db = await load();
  const anime = Object.values(db.library).filter((e) => e.item.segment === "anime" && isDone(e.status)).length;
  return { unlocked: anime >= CATEGORY_MIN, animeCompleted: anime, needed: Math.max(0, CATEGORY_MIN - anime) };
}
export const categoriesUnlocked = async () => (await getCategoryAccess()).unlocked;
export const getSpotlight = getCategoryAccess; // older name

// The Explore rows: one per category with titles in it, or [] when they aren't
// showing (locked, none made, or not the third week).
export async function loadCategoryRows(date = new Date()) {
  if (!spotlightWeek(date) || !(await categoriesUnlocked())) return [];
  const db = await load();
  return db.categories.map((c) => ({
    id: c.id,
    title: c.name,
    items: Object.values(db.library)
      .filter((e) => (e.cats || []).includes(c.id))
      .sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""))
      .map((e) => e.item),
  })).filter((r) => r.items.length);
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
    .filter(({ entry, pending }) => pending > 0 || (entry.item.nextEpisode && !entry.item.finished))
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
    if (JSON.stringify(before) !== JSON.stringify(now) || e.item.finished !== f.finished || !!e.item.unreleased !== !!f.unreleased) {
      e.item = { ...e.item, nextEpisode: now, finished: f.finished, unreleased: f.unreleased, episodes: f.episodes ?? e.item.episodes };
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
// Newest change wins, like the import. Categories, verdicts and the log are untouched.
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
// A title already in Voidation keeps whichever copy was changed more recently.
// Verdicts are never touched (AniList scores are numbers; Voidation has none).
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
// Titles already in Voidation are left as they are (your copy wins); new ones
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
  const sum = (seg) => entries.filter((e) => (e.item.segment === "manga") === (seg === "manga")).reduce((n, e) => n + (e.progress || 0), 0);
  const completed = entries.filter((e) => isDone(e.status)); // rewatching still counts as finished
  const by = (seg) => completed.filter((e) => e.item.segment === seg).length;
  // per list, per status: { anime: { watching: 3, completed: 9, … }, manga: {…} }
  const byStatus = { anime: {}, manga: {} };
  entries.forEach((e) => {
    const seg = e.item.segment === "manga" ? "manga" : "anime";
    byStatus[seg][e.status] = (byStatus[seg][e.status] || 0) + 1;
  });
  return {
    totalCompleted: completed.length,
    anime: by("anime"),
    manga: by("manga"),
    tracking: entries.length,
    episodesWatched: sum("anime"),
    chaptersRead: sum("manga"),
    // Statistics (Mihon-style): totals count every known episode/chapter of
    // your entries (a title without a known length counts what you've marked)
    episodesTotal: entries.filter((e) => e.item.segment !== "manga").reduce((n, e) => n + Math.max(totalFor(e.item) || 0, e.progress || 0), 0),
    chaptersTotal: entries.filter((e) => e.item.segment === "manga").reduce((n, e) => n + Math.max(totalFor(e.item) || 0, e.progress || 0), 0),
    minutesWatched: entries.filter((e) => e.item.segment !== "manga").reduce((n, e) => n + (e.progress || 0) * (e.item.duration || 24), 0),
    inLibrary: { anime: entries.filter((e) => e.item.segment !== "manga").length, manga: entries.filter((e) => e.item.segment === "manga").length },
    byStatus,
    verdicts: Object.keys((await load()).reviews).length,
    excited: Object.keys((await load()).excited).length,
  };
}

/* ---------- library lists: watching and reading are different ---------- */

export const LIBRARY_LISTS = [
  { key: "watch", label: "Watch list", hint: "Anime · Donghua · Korean animation", segment: "anime" },
  { key: "read", label: "Read list", hint: "Manga · Manhwa · Manhua · Comics", segment: "manga" },
];
export const inLibraryList = (entry, list) =>
  list === "read" ? entry.item.segment === "manga" : entry.item.segment !== "manga";

/* ---------- tiers ---------- */

// Ranks, by anime Completed + manga Finished. The gaps start
// at 60 and grow, so each rank takes longer than the last.
export const TIERS = [
  { key: "newbie", label: "Newbie", min: 0, color: "#9ca3af",
    title: "You are a Newbie", message: "Welcome to Voidation. Complete anime and finish manga to climb the ranks." },
  { key: "rookie", label: "Rookie", min: 5, color: "#60a5fa",
    title: "You are a Rookie", message: "5 anime completed and manga finished. You've started something." },
  { key: "amateur", label: "Amateur", min: 10, color: "#38bdf8",
    title: "You are an Amateur", message: "10 anime completed and manga finished. It's becoming a habit." },
  { key: "collector", label: "Collector", min: 25, color: "#22d3ee",
    title: "You are a Collector", message: "25 anime completed and manga finished. That's the start of a proper collection." },
  { key: "critic", label: "Critic", min: 60, color: "#2dd4bf",
    title: "You are a Critic", message: "60 anime completed and manga finished. Your verdicts carry weight now." },
  { key: "seasonkeeper", label: "Season Keeper", min: 130, color: "#34d399",
    title: "You are a Season Keeper", message: "130 anime completed and manga finished. You keep up with every season." },
  { key: "seasonmaster", label: "Season Master", min: 210, color: "#10b981",
    title: "You are a Season Master", message: "210 anime completed and manga finished. Seasons answer to you now." },
  { key: "relentless", label: "Relentless Watcher", min: 300, color: "#a3e635",
    title: "You are a Relentless Watcher", message: "300 anime completed and manga finished. Nothing slows you down." },
  { key: "champion", label: "Champion", min: 490, color: "#facc15",
    title: "You are a Champion", message: "490 anime completed and manga finished. Very few get this far." },
  { key: "elite", label: "Elite", min: 700, color: "#f59e0b",
    title: "You are Elite", message: "700 anime completed and manga finished. People ask you what to watch." },
  { key: "legend", label: "Legend", min: 1000, color: "#fb923c",
    title: "You are a Legend", message: "1,000 anime completed and manga finished. A thousand stories, and counting." },
  { key: "mythic", label: "Mythic", min: 1500, color: "#f43f5e",
    title: "You are Mythic", message: "1,500 anime completed and manga finished. They tell stories about you now." },
  { key: "unrivalled", label: "Unrivalled", min: 2000, color: "#ec4899",
    title: "You are Unrivalled", message: "2,000 anime completed and manga finished. No one is close." },
  { key: "godly", label: "Godly", min: 3000, color: "#e879f9",
    title: "You are Godly", message: "3,000 anime completed and manga finished. This is beyond human." },
  { key: "addicted", label: "Addicted", min: 3500, color: "#a855f7",
    title: "You have become an Addict", message: "3,500 anime completed and manga finished. Seriously: take a break, drink some water, go outside." },
];

export const tierFor = (n) => [...TIERS].reverse().find((t) => n >= t.min) || TIERS[0];

export async function getUserTier() {
  const stats = await getStats();
  return { tier: tierFor(stats.totalCompleted), stats };
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
export const MOODS = [
  "Made me laugh", "Made me cry", "Hyped me up", "Made me think", "Scared me",
  "Surprised me", "Relaxed me", "Motivated me", "Broke my heart", "Bored me",
];

export async function addReview(_user, segment, id, { verdict, vibes, moods, comment }) {
  const db = await load();
  db.reviews[keyOf(segment, id)] = {
    segment, titleId: id, verdict, vibes: vibes || [], moods: moods || [], comment: comment || "",
    date: new Date().toISOString(),
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

/* ---------- personal notes ("stopped at the tournament arc") ---------- */
// One private note per title, any title (in your library or not). Kept in
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
  return JSON.stringify({ app: "voidation", version: 1, exportedAt: new Date().toISOString(), ...db }, null, 2);
}

// Replaces everything with the backup. Returns an error message, or null on success.
export async function importData(json) {
  let data;
  try {
    data = JSON.parse(json);
  } catch {
    return "That file isn't a Voidation backup.";
  }
  if (data?.app !== "voidation" || typeof data.library !== "object") return "That file isn't a Voidation backup.";
  cache = {
    library: data.library || {}, reviews: data.reviews || {}, excited: data.excited || {},
    log: Array.isArray(data.log) ? data.log : [],
    categories: Array.isArray(data.categories) ? data.categories : [],
    meta: data.meta && typeof data.meta === "object" ? data.meta : {},
    settings: { ...DEFAULT_SETTINGS, ...(data.settings || {}) },
  };
  await save();
  return null;
}

// Export → Library list: every title as a spreadsheet-friendly CSV
// (Type, Title, Status, Progress, Total, Verdict, Categories, AniList link).
export async function exportLibraryCsv() {
  const db = await load();
  const cell = (v) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const catName = Object.fromEntries(db.categories.map((c) => [c.id, c.name]));
  const rows = Object.entries(db.library)
    .sort((a, b) => a[1].item.title.localeCompare(b[1].item.title))
    .map(([key, e]) => {
      const seg = e.item.segment;
      const label = statusesFor(seg).find((s) => s.key === e.status)?.label || e.status;
      const verdict = VERDICTS.find((v) => v.key === db.reviews[key]?.verdict)?.label || "";
      return [seg === "manga" ? "Manga" : "Anime", e.item.title, label, e.progress || 0, totalFor(e.item) ?? "",
        verdict, (e.cats || []).map((c) => catName[c]).filter(Boolean).join("; "), e.item.url || ""].map(cell).join(",");
    });
  return ["Type,Title,Status,Progress,Total,Verdict,Categories,AniList", ...rows].join("\n") + "\n";
}

// Size of everything Voidation has saved, in bytes (Data & storage).
export async function storageSize() {
  return JSON.stringify(await load()).length;
}

// Wipe the library, verdicts and Excited list. Settings stay.
export async function clearData() {
  const db = await load();
  cache = { ...EMPTY(), settings: db.settings, categories: db.categories }; // your categories stay, empty
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

// Voidation data layer. Shared by the app AND the website: every screen talks
// ONLY to these functions, so both clients keep the same data in the same shape.
//
// There are no accounts. Everything lives in one JSON document on this device
// (see storage.js):
//   library  {"segment:id" -> { status, progress, item snapshot, updatedAt, delay? }}
//   reviews  {"segment:id" -> { verdict, vibes, comment, date }}
//   excited  {"segment:id" -> { item, at }}
//   settings { clock24, posterBadges }
//
// Functions still take `user` as their first argument, so screens written for
// the account version didn't have to change. It is always the local user.

import { readKey, writeKey } from "./storage.js";

const DB_KEY = "voidation:db:v1";
// notifyEpisodes only matters in the app (the website can't schedule alerts)
export const DEFAULT_SETTINGS = { clock24: false, posterBadges: true, notifyEpisodes: true };
const EMPTY = () => ({ library: {}, reviews: {}, excited: {}, settings: { ...DEFAULT_SETTINGS } });

let cache = null;
let writing = Promise.resolve();

async function load() {
  if (cache) return cache;
  try {
    const raw = await readKey(DB_KEY);
    const saved = raw ? JSON.parse(raw) : {};
    cache = { ...EMPTY(), ...saved, settings: { ...DEFAULT_SETTINGS, ...(saved.settings || {}) } };
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

/* ---------- tracking ---------- */

export function statusesFor(segment) {
  const reading = segment === "manga";
  return [
    { key: "watching", label: reading ? "Reading" : "Watching" },
    { key: "completed", label: reading ? "Finished" : "Completed" },
    { key: "plan", label: reading ? "Plan to Read" : "Plan to Watch" },
    { key: "onhold", label: "On Hold" },
    { key: "dropped", label: "Dropped" },
  ];
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
    delete db.library[key];
    return save();
  }
  const prev = db.library[key];
  const total = totalFor({ ...item, segment });
  db.library[key] = {
    ...prev,
    status,
    // finishing a title fills its progress, the way AniList does
    progress: status === "completed" && total ? total : prev?.progress || 0,
    item: freshest(prev?.item, { ...item, segment }),
    updatedAt: new Date().toISOString(),
  };
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
  if (item.nextEpisode) return item.nextEpisode.episode - 1;
  return item.finished ? item.episodes ?? null : null;
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
export async function setProgress(_user, item, n) {
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
  db.library[key] = {
    ...prev,
    status,
    progress,
    item: freshest(prev?.item, item),
    updatedAt: new Date().toISOString(),
  };
  await save();
  return { progress, status, reachedEnd: !!total && progress >= total && status !== "completed" };
}

/* ---------- library sorting (app + website) ---------- */

export const LIBRARY_SORTS = [
  { key: "updated", label: "Recently updated" },
  { key: "title", label: "Title A–Z" },
  { key: "airing", label: "Airing soonest", anime: true },
  { key: "behind", label: "Most to catch up", anime: true },
];

export function sortEntries(list, sort) {
  const s = [...list];
  if (sort === "title") s.sort((a, b) => a.item.title.localeCompare(b.item.title));
  else if (sort === "airing") {
    const t = (e) => e.item.nextEpisode?.airingAt ?? Infinity;
    s.sort((a, b) => t(a) - t(b));
  } else if (sort === "behind") s.sort((a, b) => behindBy(b) - behindBy(a));
  else s.sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
  return s;
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
    if (JSON.stringify(before) !== JSON.stringify(now) || e.item.finished !== f.finished) {
      e.item = { ...e.item, nextEpisode: now, finished: f.finished, episodes: f.episodes ?? e.item.episodes };
      changed = true;
    }
  });
  if (changed) await save();
  return changed;
}

/* ---------- import from AniList ---------- */

const ANILIST_STATUS = {
  CURRENT: "watching", REPEATING: "watching", PLANNING: "plan",
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

export async function getStats() {
  const entries = Object.values((await load()).library);
  const sum = (seg) => entries.filter((e) => (e.item.segment === "manga") === (seg === "manga")).reduce((n, e) => n + (e.progress || 0), 0);
  const completed = entries.filter((e) => e.status === "completed");
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

export const TIERS = [
  { key: "rookie", label: "Rookie", min: 0, color: "#9ca3af" },
  { key: "explorer", label: "Explorer", min: 25, color: "#22d3ee" },
  { key: "collector", label: "Collector", min: 55, color: "#10b981" },
  { key: "critic", label: "Critic", min: 100, color: "#f59e0b" },
  { key: "elite", label: "Elite", min: 360, color: "#f43f5e" },
  { key: "legend", label: "Legend", min: 999, color: "#a243a6" },
  { key: "addicted", label: "Addicted", min: 9999, color: "#a855f7" },
];

export const tierFor = (n) => [...TIERS].reverse().find((t) => n >= t.min) || TIERS[0];

export async function getUserTier() {
  const stats = await getStats();
  return { tier: tierFor(stats.totalCompleted), stats };
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

export async function addReview(_user, segment, id, { verdict, vibes, comment }) {
  const db = await load();
  db.reviews[keyOf(segment, id)] = {
    segment, titleId: id, verdict, vibes: vibes || [], comment: comment || "",
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
    settings: { ...DEFAULT_SETTINGS, ...(data.settings || {}) },
  };
  await save();
  return null;
}

// Size of everything Voidation has saved, in bytes (Data & storage).
export async function storageSize() {
  return JSON.stringify(await load()).length;
}

// Wipe the library, verdicts and Excited list. Settings stay.
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

// Two-way sync with your AniList account. No VoidPop server: AniList itself
// holds the list, so the app and the website (and AniList's own site) all agree.
//
//   Synced:        status and progress of every anime and manga in your library
//   Not synced:    verdicts, categories, Excited, the watch log (AniList has no
//                  place for them; they stay on this device and in your backups)
//
// How it works:
//   - Your changes (status, +1, removal) are queued and sent a couple of
//     seconds later; offline, they wait and go when you're back online.
//   - AniList's list is pulled on open, when the app comes back to the front,
//     in the background job, and on "Sync now". The newer change wins; your
//     unsent changes always win.
//   - The first sync merges both ways: titles only in VoidPop are added to
//     AniList, titles only on AniList are added to VoidPop.
//
// Sign-in uses AniList's "implicit grant": no password ever touches VoidPop;
// AniList hands back a token that lasts a year. Each platform plugs in its own
// way of opening AniList's sign-in page (configureAniListSync).

import { readKey, writeKey, removeKey } from "../backend/storage.js";
import {
  fetchViewer, fetchAniListUserList, saveListEntry, deleteListEntry, AniListAuthError,
} from "../api/anilist.js";
import { applyAniListPull, getLibrary, setEntryChangeHook } from "../backend/store.js";

const KEY = "voidation:anilist:v1";
const TO_ANILIST = { watching: "CURRENT", rewatching: "REPEATING", plan: "PLANNING", completed: "COMPLETED", onhold: "PAUSED", dropped: "DROPPED" };
const PULL_EVERY_MS = 2 * 60 * 1000;
const PUSH_DELAY_MS = 2500;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let config = { clientId: "", redirectUri: "" };
let state = null; // { token, expiresAt, user, lastSync, ids: {key: listId}, queue: {key: op}, first }
let status = { busy: false, error: "" };
const listeners = new Set();

export function configureAniListSync({ clientId, redirectUri }) {
  config = { clientId: clientId ? String(clientId) : "", redirectUri: redirectUri || "" };
}
export const syncConfigured = () => !!config.clientId;
export const redirectUri = () => config.redirectUri;

async function loadState() {
  if (state) return state;
  try { state = JSON.parse((await readKey(KEY)) || "null"); } catch { state = null; }
  return state;
}
async function saveState() {
  if (state) await writeKey(KEY, JSON.stringify(state));
  else await removeKey(KEY);
  emit();
}

export async function getSyncState() {
  const s = await loadState();
  return {
    configured: syncConfigured(),
    connected: !!s?.token,
    user: s?.user || null,
    lastSync: s?.lastSync || null,
    pending: s ? Object.keys(s.queue || {}).length : 0,
    busy: status.busy,
    error: status.error,
  };
}
export function onSyncState(fn) {
  listeners.add(fn);
  getSyncState().then(fn);
  return () => listeners.delete(fn);
}
function emit() {
  getSyncState().then((s) => listeners.forEach((fn) => { try { fn(s); } catch { /* ignore */ } }));
}

/* ---------- sign in / out ---------- */

export function authUrl() {
  return `https://anilist.co/api/v2/oauth/authorize?client_id=${encodeURIComponent(config.clientId)}&response_type=token`;
}

// url: where AniList sent you back, e.g. ".../auth/anilist#access_token=…&expires_in=…"
export async function finishSignIn(url) {
  const hash = String(url).split("#")[1] || String(url).split("?")[1] || "";
  const params = new URLSearchParams(hash);
  const token = params.get("access_token");
  if (!token) throw new Error(params.get("error_description") || "AniList didn't finish signing in. Try again.");
  const user = await fetchViewer(token);
  const expiresIn = Number(params.get("expires_in")) || 365 * 86400;
  state = { token, expiresAt: Date.now() + expiresIn * 1000, user, lastSync: null, ids: {}, queue: {}, first: true };
  status.error = "";
  await saveState();
  return syncNow({ reason: "first", force: true });
}

export async function signOut() {
  state = null;
  status = { busy: false, error: "" };
  await saveState();
}

/* ---------- your changes → AniList ---------- */

let pushTimer = null;
setEntryChangeHook((key, entry) => {
  // async on purpose: the library save must never wait for sync
  (async () => {
    const s = await loadState();
    if (!s?.token) return;
    const [segment, id] = key.split(":");
    s.queue = s.queue || {};
    s.queue[key] = entry
      ? { segment, mediaId: Number(id), status: entry.status, progress: entry.progress, at: Date.now() }
      : { segment, mediaId: Number(id), status: null, at: Date.now() };
    await saveState();
    clearTimeout(pushTimer);
    pushTimer = setTimeout(() => { push().catch(() => {}); }, PUSH_DELAY_MS);
  })();
});

async function push() {
  const s = await loadState();
  if (!s?.token) return;
  for (const [key, op] of Object.entries({ ...(s.queue || {}) })) {
    // Considering lives on this phone only: AniList has no such status, so it is never sent
    // (a title already on AniList stays there as it was)
    if (op.status === "considering") { delete s.queue[key]; await saveState(); continue; }
    try {
      if (op.status === null) {
        await deleteListEntry(s.token, { listId: s.ids?.[key], userId: s.user.id, mediaId: op.mediaId });
        delete s.ids[key];
      } else {
        s.ids = s.ids || {};
        s.ids[key] = await saveListEntry(s.token, op.mediaId, TO_ANILIST[op.status] || "CURRENT", op.progress || 0);
      }
      // a newer change to the same title may have arrived while this one was sending
      if (s.queue[key]?.at === op.at) delete s.queue[key];
      await saveState();
    } catch (e) {
      if (e instanceof AniListAuthError) throw e;
      if (/not found|invalid|validation/i.test(e.message || "")) {
        delete s.queue[key]; // AniList won't accept it (removed title, adult title…): drop it
        await saveState();
        continue;
      }
      throw e; // offline / AniList busy: keep the rest queued for next time
    }
    await sleep(700); // stay well under AniList's per-minute limit
  }
}

/* ---------- AniList → VoidPop ---------- */

async function pull(first) {
  const s = await loadState();
  const remote = await fetchAniListUserList({ userId: s.user.id, token: s.token });
  const remoteKeys = new Set(remote.map((r) => `${r.item.segment}:${r.item.id}`));
  const pending = new Set(Object.keys(s.queue || {}));
  // was on AniList last time, gone now = you removed it there
  const removed = first ? [] : Object.keys(s.ids || {}).filter((k) => !remoteKeys.has(k));
  const { oursNewer, ...result } = await applyAniListPull(remote, { skip: pending, removed });
  s.ids = Object.fromEntries(remote.map((r) => [`${r.item.segment}:${r.item.id}`, r.listId]));
  // on both sides but changed more recently here: send ours
  if (oursNewer.length) {
    const lib = await getLibrary();
    oursNewer.forEach((key) => {
      const e = lib[key];
      if (e) s.queue[key] = { segment: e.item.segment, mediaId: Number(e.item.id), status: e.status, progress: e.progress || 0, at: Date.now() };
    });
  }
  if (first) {
    // titles only in VoidPop go up to AniList
    const lib = await getLibrary();
    Object.entries(lib).forEach(([key, e]) => {
      if (!remoteKeys.has(key) && !s.queue[key]) {
        s.queue[key] = { segment: e.item.segment, mediaId: Number(e.item.id), status: e.status, progress: e.progress || 0, at: Date.now() };
      }
    });
    s.first = false;
  }
  await saveState();
  return result;
}

let running = null;
// Push waiting changes, then pull (at most every 2 minutes unless forced).
// Resolves to { added, updated, removed } from the pull, or null.
export function syncNow({ reason = "manual", force = false } = {}) {
  running = running || (async () => {
    const s = await loadState();
    if (!s?.token) return null;
    if (s.expiresAt && Date.now() > s.expiresAt) {
      status.error = "Your AniList sign-in has expired. Sign in again.";
      emit();
      return null;
    }
    status = { busy: true, error: "" };
    emit();
    try {
      const due = force || reason === "manual" || !s.lastSync || Date.now() - new Date(s.lastSync).getTime() > PULL_EVERY_MS;
      await push();
      const result = due ? await pull(!!s.first) : null;
      if (due && Object.keys(s.queue || {}).length) await push(); // send what the pull found newer here (and, first time, VoidPop-only titles)
      if (due) s.lastSync = new Date().toISOString();
      await saveState();
      return result;
    } catch (e) {
      status.error = e instanceof AniListAuthError
        ? e.message
        : "Couldn't sync with AniList right now. Your changes are saved and will be sent later.";
      return null;
    } finally {
      status.busy = false;
      running = null;
      emit();
    }
  })();
  return running;
}

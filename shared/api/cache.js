// Offline copy of AniList answers, kept on this device.
//
// Every AniList request is tried online first. When it works, the answer is
// saved; when the phone is offline (or AniList is down), the last saved answer
// for the same request is used instead, and the app shows "Offline · info from
// 2h ago". Countdowns keep ticking offline because they're computed from air
// times, not fetched.
//
// Size-capped (oldest answers are dropped first) so it can never crowd out
// your library in storage.

import { readKey, writeKey, removeKey } from "../backend/storage.js";

const INDEX_KEY = "voidation:cache:index";
const PREFIX = "voidation:cache:";
const MAX_BYTES = 1_500_000; // ~1.5 MB of text
const MAX_ENTRIES = 120;

// short, stable name for a request (djb2 hash)
export function cacheKey(text) {
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

let index = null; // [{ k, at, size }], newest last
async function loadIndex() {
  if (index) return index;
  try { index = JSON.parse((await readKey(INDEX_KEY)) || "[]"); } catch { index = []; }
  return index;
}

export async function cacheGet(k) {
  try {
    const raw = await readKey(PREFIX + k);
    return raw ? JSON.parse(raw) : null; // { at, data }
  } catch {
    return null;
  }
}

let writing = Promise.resolve();
export function cachePut(k, data) {
  writing = writing.then(async () => {
    const text = JSON.stringify({ at: Date.now(), data });
    if (text.length > MAX_BYTES / 3) return; // one giant answer isn't worth pushing everything else out
    const idx = (await loadIndex()).filter((e) => e.k !== k);
    idx.push({ k, at: Date.now(), size: text.length });
    let total = idx.reduce((n, e) => n + e.size, 0);
    while (idx.length > MAX_ENTRIES || total > MAX_BYTES) {
      const old = idx.shift();
      total -= old.size;
      await removeKey(PREFIX + old.k);
    }
    await writeKey(PREFIX + k, text);
    index = idx;
    await writeKey(INDEX_KEY, JSON.stringify(idx));
  }).catch(() => {});
  return writing;
}

export async function cacheClear() {
  const idx = await loadIndex();
  for (const e of idx) await removeKey(PREFIX + e.k);
  index = [];
  await writeKey(INDEX_KEY, "[]");
}

export async function cacheSize() {
  return (await loadIndex()).reduce((n, e) => n + e.size, 0);
}

/* ---------- online / offline, for the banner ---------- */
//
// "Offline" means the DEVICE has no internet (the app asks Android via NetInfo;
// the website asks the browser). An AniList hiccup while you're online (it
// allows only so many requests a minute) is not "offline": saved answers are
// used quietly and no banner is shown.

let deviceOnline = true;
let oldestShown = null; // save time of the oldest answer shown while offline
let state = { offline: false, since: null };
const listeners = new Set();

export function onNetState(fn) {
  listeners.add(fn);
  fn(state);
  return () => listeners.delete(fn);
}
function emit(next) {
  if (next.offline === state.offline && next.since === state.since) return;
  state = next;
  listeners.forEach((fn) => { try { fn(state); } catch { /* ignore */ } });
}

export const isDeviceOnline = () => deviceOnline;

// Called by each platform's startup code whenever connectivity changes.
export function setDeviceOnline(online) {
  deviceOnline = !!online;
  if (deviceOnline) oldestShown = null;
  emit({ offline: !deviceOnline, since: deviceOnline ? null : oldestShown });
}

// A saved answer was shown instead of a fresh one.
export function noteSavedShown(savedAt) {
  if (deviceOnline) return;
  oldestShown = oldestShown ? Math.min(oldestShown, savedAt) : savedAt;
  emit({ offline: true, since: oldestShown });
}

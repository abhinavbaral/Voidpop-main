// Second and third opinions on "when does the next episode air", for when AniList alone is stale or silent.
//
//   Shikimori      GET shikimori.io/api/animes/{MAL id}   next_episode_at + episodes_aired: an exact time for one episode
//   MyAnimeList    GET api.jikan.moe/v4/anime/{MAL id}    broadcast: a weekly slot in Japan time (no episode number)
//                  (Jikan is a free, key-less read-only copy of MyAnimeList)
//
// Neither needs a key. Both are polite: one request at a time, spaced out, answers saved on the phone, and every
// failure (offline, busy, unknown show, changed format) quietly returns null. The countdown then just falls back to
// AniList and the weekly estimate. Nothing here can throw into the screens.
//
// LiveChart is not here on purpose: it has no public API. Its only machine-readable API is the one its own Android
// app uses, which needs a LiveChart login and a copied app identity, so it is not something an app can ship.

import { readKey, writeKey } from "../backend/storage.js";
import { isDeviceOnline } from "./cache.js";
import { parseBroadcast, reconcileNext, isStale } from "../features/nextEpisode.js";

const SHIKIMORI = "https://shikimori.io/api/animes/";
const JIKAN = "https://api.jikan.moe/v4/anime/";
const KEY = "voidation:nextsrc:v1";
const MAX_ENTRIES = 200;

// how long an answer is reused (and a "nothing / failed" answer, so a busy server isn't asked again at once)
const TTL = {
  shikimori: { ok: 20 * 60e3, miss: 10 * 60e3 }, // an air time can move: look again within the half hour
  jikan: { ok: 24 * 3600e3, miss: 30 * 60e3 },   // a weekly slot hardly ever changes
};
export const GAP_MS = { shikimori: 700, jikan: 400 }; // 90 and 60 requests a minute are their limits
const TIMEOUT_MS = 8000;

/* ---------- saved answers ---------- */

let saved = null; // { "shiki:123": { at, v } }
async function load() {
  if (saved) return saved;
  try { saved = JSON.parse((await readKey(KEY)) || "{}") || {}; } catch { saved = {}; }
  return saved;
}
async function remember(k, v) {
  const db = await load();
  db[k] = { at: Date.now(), v };
  const keys = Object.keys(db);
  if (keys.length > MAX_ENTRIES) keys.sort((a, b) => db[a].at - db[b].at).slice(0, keys.length - MAX_ENTRIES).forEach((o) => delete db[o]);
  try { await writeKey(KEY, JSON.stringify(db)); } catch { /* storage full or gone: the answer still counts for this session */ }
}
export function forgetSavedSources() { saved = null; }

/* ---------- one request at a time per site, spaced ---------- */

const lanes = {}; // per site: a promise that never rejects and settles one gap after the last request
function throttled(site, task) {
  const run = (lanes[site] || Promise.resolve()).then(task);
  const gap = () => new Promise((r) => setTimeout(r, GAP_MS[site]));
  lanes[site] = run.then(gap, gap);
  return run;
}

async function getJson(url) {
  const ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timer = ctrl && setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": "VoidPop/1.0" }, // Shikimori asks every app to name itself
      signal: ctrl?.signal,
    });
    if (!res.ok) return null;
    return await res.json();
  } finally {
    if (timer) clearTimeout(timer);
  }
}

// answer for `k`: the saved one if young enough, else ask. Failures are saved briefly as null.
async function cached(site, k, ask) {
  const hit = (await load())[k];
  if (hit && Date.now() - hit.at < (hit.v == null ? TTL[site].miss : TTL[site].ok)) return hit.v;
  if (!isDeviceOnline()) return hit ? hit.v : null;
  let v = null;
  try { v = await throttled(site, ask); } catch { v = null; }
  await remember(k, v);
  return v;
}

/* ---------- the two sources ---------- */

// { episode, airingAt } for the next episode, or null
export function fetchShikimori(malId) {
  if (!malId) return Promise.resolve(null);
  return cached("shikimori", `shiki:${malId}`, async () => {
    const j = await getJson(SHIKIMORI + Number(malId));
    if (!j || !j.next_episode_at) return null; // finished, or no air time known
    const airingAt = Math.floor(Date.parse(j.next_episode_at) / 1000);
    const episode = (Number(j.episodes_aired) || 0) + 1;
    if (!Number.isFinite(airingAt) || airingAt <= 0) return null;
    if (j.episodes > 0 && episode > j.episodes) return null;
    return { episode, airingAt };
  });
}

// { phase } for the weekly slot, or null
export function fetchMalBroadcast(malId) {
  if (!malId) return Promise.resolve(null);
  return cached("jikan", `jikan:${malId}`, async () => {
    const j = await getJson(JIKAN + Number(malId));
    return parseBroadcast(j?.data?.broadcast);
  });
}

/* ---------- putting it together ---------- */

// items: { id -> item } as fetchNextEpisodes() built them from AniList. Returns the same map with each item's
// nextEpisode settled by reconcileNext(). Asks the other sources only where it matters:
//   - AniList's time has passed (stale) or AniList has none for a show that is airing  -> Shikimori
//   - verify (one title's page): every airing show also gets both opinions, for the "confirmed" note
// At most `maxLookups` titles per call; the stalest first. Everything else is local arithmetic.
export async function settleNextEpisodes(items, { verify = false, now = Date.now(), maxLookups = 6 } = {}) {
  const ids = Object.keys(items);
  const airing = (it) => it.segment === "anime" && !it.finished && !it.unreleased;
  const needs = (it) => airing(it) && it.idMal && (verify || isStale(it.nextEpisode, now) || !it.nextEpisode);
  const queue = ids.filter((id) => needs(items[id]))
    .sort((a, b) => (items[a].nextEpisode?.airingAt ?? 0) - (items[b].nextEpisode?.airingAt ?? 0))
    .slice(0, maxLookups);

  const opinions = {};
  for (const id of queue) {
    const it = items[id];
    const [shikimori, slot] = await Promise.all([fetchShikimori(it.idMal), verify ? fetchMalBroadcast(it.idMal) : null]);
    opinions[id] = { shikimori, slot };
  }

  const out = {};
  for (const id of ids) {
    const it = items[id];
    if (it.segment !== "anime") { out[id] = it; continue; }
    const next = reconcileNext({ anilist: it.nextEpisode || null, ...(opinions[id] || {}), episodes: it.episodes, now });
    out[id] = next === it.nextEpisode ? it : { ...it, nextEpisode: next };
  }
  return out;
}

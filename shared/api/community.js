// VoidPop's own backend (server/): accounts, community Void Verdicts, comments, cloud backup.
// The only file that talks to it, the way api/anilist.js is the only one that talks to AniList.
//
// Everything here is optional. With no server address configured (hasCommunity() is false) the
// app works exactly as before, fully on this device, and the UI hides sign-in and comments.
//
// The login token is kept in the same on-device storage as your library (backend/storage.js).

import { readKey, writeKey, removeKey } from "../backend/storage.js";
import { exportData, importData } from "../backend/store.js";

const ACCOUNT_KEY = "voidpop:account:v1";
const SYNC_KEY = "voidpop:sync-version:v1";

let baseUrl = "";
export function configureCommunity({ baseUrl: url } = {}) {
  if (typeof url === "string") baseUrl = url.trim().replace(/\/+$/, "");
}
export const hasCommunity = () => !!baseUrl;

/* ---------- who is signed in ---------- */

let account = null;        // { token, user } or null
let loaded = false;
const listeners = new Set();
const emit = () => listeners.forEach((fn) => { try { fn(account?.user ?? null); } catch { /* a bad listener mustn't break others */ } });

async function setAccount(next) {
  account = next;
  if (next) await writeKey(ACCOUNT_KEY, JSON.stringify(next));
  else { await removeKey(ACCOUNT_KEY); await removeKey(SYNC_KEY); }
  emit();
}

// call once at start-up (and it's cheap to call again): reads the saved login
export async function loadAccount() {
  if (!loaded) {
    loaded = true;
    try {
      const raw = await readKey(ACCOUNT_KEY);
      const a = raw ? JSON.parse(raw) : null;
      account = a?.token && a?.user ? a : null;
    } catch { account = null; }
    emit();
  }
  return account?.user ?? null;
}
export const currentUser = () => account?.user ?? null;
export function onAccountChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }

/* ---------- requests ---------- */

export class ApiError extends Error {
  constructor(status, message, extra) { super(message); this.status = status; this.extra = extra; }
}

async function request(method, path, body) {
  if (!baseUrl) throw new ApiError(0, "No VoidPop server is set up.");
  let res;
  try {
    res = await fetch(baseUrl + path, {
      method,
      headers: { "Content-Type": "application/json", ...(account ? { Authorization: `Bearer ${account.token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, "Can't reach VoidPop right now. Check your connection.");
  }
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    // a saved login the server no longer accepts (expired, or the account was deleted): sign out locally
    if (res.status === 401 && account && path !== "/api/auth/login") await setAccount(null);
    throw new ApiError(res.status, json.error || "Something went wrong.", json);
  }
  return json;
}

/* ---------- accounts ---------- */

export async function register({ email, username, password }) {
  const r = await request("POST", "/api/auth/register", { email, username, password });
  await setAccount({ token: r.token, user: r.user });
  return r.user;
}
export async function login({ identifier, password }) {
  const r = await request("POST", "/api/auth/login", { identifier, password });
  await setAccount({ token: r.token, user: r.user });
  return r.user;
}
export async function logout() { await setAccount(null); }
export async function deleteAccount() {
  await request("DELETE", "/api/me");
  await setAccount(null);
}

/* ---------- verdicts ---------- */

// { total, counts: {peak, divein, onetime, voidit}, mine? }
export const fetchTitleVerdicts = (segment, id) => request("GET", `/api/titles/${segment}/${encodeURIComponent(id)}/verdicts`);

// Share your verdict with the community. Quietly does nothing when signed out or offline:
// your verdict is always saved on the device first.
export async function pushVerdict(segment, id, { verdict, status, moods, title, image }) {
  if (!hasCommunity() || !account) return false;
  try { await request("PUT", `/api/verdicts/${segment}/${encodeURIComponent(id)}`, { verdict, status, moods, title, image }); return true; }
  catch { return false; }
}
export async function dropVerdict(segment, id) {
  if (!hasCommunity() || !account) return false;
  try { await request("DELETE", `/api/verdicts/${segment}/${encodeURIComponent(id)}`); return true; } catch { return false; }
}

// Every title with enough counted verdicts and how they split: [{ segment, id, title, image, total, counts }].
// Explore ranks these itself (features/communityRank.js); the server only counts.
export const fetchRankings = (min) => request("GET", `/api/rankings${min ? `?min=${min}` : ""}`).then((r) => r.titles || []);

/* ---------- comments ---------- */

export const fetchComments = (segment, id, { before } = {}) =>
  request("GET", `/api/titles/${segment}/${encodeURIComponent(id)}/comments${before ? `?before=${before}` : ""}`);
export const postComment = (segment, id, body, parentId) =>
  request("POST", `/api/titles/${segment}/${encodeURIComponent(id)}/comments`, { body, ...(parentId ? { parentId } : {}) }).then((r) => r.comment);
export const editComment = (commentId, body) => request("PATCH", `/api/comments/${commentId}`, { body }).then((r) => r.comment);
export const deleteComment = (commentId) => request("DELETE", `/api/comments/${commentId}`);
export const setCommentLike = (commentId, on) => request(on ? "PUT" : "DELETE", `/api/comments/${commentId}/like`);

/* ---------- cloud backup (you choose when; nothing merges silently) ---------- */

const localVersion = async () => Number(await readKey(SYNC_KEY)) || 0;

// Save this device's whole library to your account.
// Throws ApiError(409) when another device saved first: restore (or decide) before overwriting it.
export async function pushBackup() {
  const r = await request("PUT", "/api/sync", { data: await exportData(), baseVersion: await localVersion() });
  await writeKey(SYNC_KEY, String(r.version));
  return r.version;
}

// Replace this device's library with the one in your account. → true, or false when there is none yet.
export async function pullBackup() {
  const r = await request("GET", "/api/sync");
  if (!r.data) return false;
  const problem = await importData(r.data); // importData returns an error message, or null when it worked
  if (problem) throw new ApiError(0, problem);
  await writeKey(SYNC_KEY, String(r.version));
  return true;
}

/* ---------- keeping the community in step with your shelf ---------- */

// After you change a movie/series on your shelf: share its verdict (with the new status, so
// "Watchlist" stops counting) or take it back when there's no verdict any more.
// `entry` is what getCinemaEntry() returns, or null when it's off your shelf.
export async function syncCinemaVerdict(item, entry) {
  if (!entry?.review) return dropVerdict(item.segment, item.id);
  return pushVerdict(item.segment, item.id, {
    verdict: entry.review.verdict, status: entry.status, moods: entry.review.moods,
    title: item.title, image: item.imageSmall || item.image,
  });
}

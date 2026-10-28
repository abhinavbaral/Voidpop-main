// VoidPop's own backend (server/): accounts, community Void Verdicts, comments, cloud backup.
// The only file that talks to it, the way api/anilist.js is the only one that talks to AniList.
//
// Everything here is optional. With no server address configured (hasCommunity() is false) the
// app works exactly as before, fully on this device, and the UI hides sign-in and comments.
//
// The login token is kept in the same on-device storage as your library (backend/storage.js).

import { readKey, writeKey, removeKey } from "../backend/storage.js";
import { exportData, importData, mergeData, getLibrary, getLibraryAll, getReviews, getCinemaShelf } from "../backend/store.js";

const ACCOUNT_KEY = "voidpop:account:v1";
const SYNC_KEY = "voidpop:sync-version:v1";
const CHOICE_KEY = "voidpop:auth-choice:v1"; // "guest" once someone has chosen to go on without an account
const ASKED_KEY = "voidpop:signin-asked:v1"; // the last verdict milestone a guest was asked "Want to sign in?" at

let baseUrl = "";
export function configureCommunity({ baseUrl: url } = {}) {
  if (typeof url === "string") baseUrl = url.trim().replace(/\/+$/, "");
}
export const hasCommunity = () => !!baseUrl;

/* ---------- who is signed in ---------- */

let account = null;        // { token, user } or null
let choice = null;         // "guest" or null (not chosen yet)
let loading = null;        // the one read of the saved login, shared by everyone who asks
let asked = 0;             // the highest verdict milestone already asked at
const listeners = new Set();
const emit = () => listeners.forEach((fn) => { try { fn(account?.user ?? null); } catch { /* a bad listener mustn't break others */ } });

async function setAccount(next) {
  account = next;
  if (next) {
    await writeKey(ACCOUNT_KEY, JSON.stringify(next));
    if (choice) { choice = null; await removeKey(CHOICE_KEY); } // signed in: "guest" no longer applies
  } else { await removeKey(ACCOUNT_KEY); await removeKey(SYNC_KEY); }
  emit();
}

// call once at start-up (and it's cheap to call again): reads the saved login
export async function loadAccount() {
  loading ||= (async () => {
    try {
      const raw = await readKey(ACCOUNT_KEY);
      const a = raw ? JSON.parse(raw) : null;
      account = a?.token && a?.user ? a : null;
    } catch { account = null; }
    try { choice = (await readKey(CHOICE_KEY)) === "guest" ? "guest" : null; } catch { choice = null; }
    try { asked = Number(await readKey(ASKED_KEY)) || 0; } catch { asked = 0; }
    emit();
  })();
  await loading; // a second caller waits for the read instead of seeing "nobody" while it is still going
  return account?.user ?? null;
}

// Going on without an account is a choice the person makes once; it is remembered so the sign-in screen isn't shown again.
export async function chooseGuest() {
  choice = "guest";
  await writeKey(CHOICE_KEY, "guest");
}
// While someone uses the app without an account they are asked "Want to sign in?" at their 1st verdict, then at every
// 30 more: 1, 30, 60, 90... The milestone a count has reached (0 = none yet). Reaching it again later asks nothing new.
export const askMilestone = (count) => (count < 1 ? 0 : count < 30 ? 1 : Math.floor(count / 30) * 30);

// → { milestone, count } when the person should be asked now, else null. Only on a build with a server (nothing to sign in
// to otherwise) and only while signed out. A count that jumps past a milestone (an import) still asks once, at the latest one.
export async function nextSignInAsk() {
  await loadAccount();
  if (!hasCommunity() || account) return null;
  const count = (await localVerdicts()).length;
  const milestone = askMilestone(count);
  return milestone > asked ? { milestone, count } : null;
}
// Call when the question is shown: it is asked once per milestone, whatever the answer.
export async function markSignInAsked(milestone) {
  asked = Math.max(asked, milestone);
  await writeKey(ASKED_KEY, String(asked));
}

// Someone who picked Guest mode and hasn't signed in since: the welcome screen asks them, gently, whether they want to.
export async function isGuest() {
  await loadAccount();
  return !account && choice === "guest";
}
// Should the welcome screen say "Login"? Anyone who isn't signed in and hasn't chosen guest mode, server or not: the login screen
// itself says when accounts aren't available yet, and offers Guest mode.
export async function shouldOfferLogin() {
  await loadAccount();
  return !account && choice !== "guest";
}
// Show the sign-in screen? Only when there is a server to sign in to, nobody is signed in, and they haven't chosen guest.
// (A login that expired counts as signed out and no guest choice: they are asked again.)
export async function shouldAskSignIn() {
  await loadAccount();
  return hasCommunity() && !account && choice !== "guest";
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
    // a saved login the server no longer accepts (expired, or the account was deleted): sign out locally.
    // Not for /api/auth/*: a refused password or Google/Apple token isn't news about the login you already have.
    if (res.status === 401 && account && !path.startsWith("/api/auth/")) await setAccount(null);
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
// Signing out (or deleting the account) leaves you as a guest: the app keeps working, no sign-in screen is forced on you
export async function logout() { await setAccount(null); await chooseGuest(); }
export async function deleteAccount() {
  await request("DELETE", "/api/me");
  await setAccount(null);
  await chooseGuest();
}

// Google / Apple: the phone gets an ID token from them (app/src/services/socialSignIn.js) and the server checks it.
// Signed out: signs in (or makes the account). Signed in: connects that Google/Apple account to this one.
async function socialLogin(path, body) {
  const r = await request("POST", path, body);
  await setAccount({ token: r.token, user: r.user });
  return { user: r.user, isNew: !!r.isNew, linked: !!r.linked };
}
export const loginWithGoogle = (idToken) => socialLogin("/api/auth/google", { idToken });
export const loginWithApple = ({ identityToken, name }) => socialLogin("/api/auth/apple", { identityToken, ...(name ? { name } : {}) });

// which of Google / Apple this server has set up, so only buttons that can work are shown. Cached once it is known.
let providers = null;
export async function fetchProviders() {
  if (providers) return providers;
  try { providers = await request("GET", "/api/auth/providers"); } catch { return { google: false, apple: false }; }
  return providers;
}

// people who came in with Google/Apple get a made-up username: this changes it
export async function updateUsername(username) {
  const r = await request("PATCH", "/api/me", { username });
  await setAccount({ token: account.token, user: r.user });
  return r.user;
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

/* ---------- a guest who signs in: bring what is already on this phone ---------- */

// how many titles are on this phone (what a new sign-in would bring along)
export async function localTitleCount() { return Object.keys(await getLibraryAll()).length; }

// Every verdict on this phone, whatever the status. The server counts only the ones on finished or dropped titles in the
// split, but keeps the rest (they show as your chip on your comments and come back as "yours" on another phone).
async function localVerdicts() {
  const [library, reviews, shelf] = await Promise.all([getLibrary(), getReviews(), getCinemaShelf()]);
  const out = [];
  for (const r of reviews) { // anime, manga and novels: the verdict is separate from the library entry
    const e = library[`${r.segment}:${r.titleId}`];
    if (!e) continue;
    out.push({ segment: r.segment, id: String(r.titleId), verdict: r.verdict, status: e.status, moods: r.moods || [], title: e.item?.title, image: e.item?.imageSmall || e.item?.image });
  }
  for (const e of shelf) { // movies and TV keep it on the shelf entry
    if (e.review) out.push({ segment: e.item.segment, id: String(e.item.id), verdict: e.review.verdict, status: e.status, moods: e.review.moods || [], title: e.item.title, image: e.item.imageSmall || e.item.image });
  }
  return out;
}

// Share every verdict already on this phone with the community (only new changes were shared before), 100 per request
// until all are sent. → how many were saved
export async function shareAllVerdicts() {
  if (!hasCommunity() || !account) return 0;
  const all = await localVerdicts();
  let saved = 0;
  for (let i = 0; i < all.length; i += 100) saved += (await request("POST", "/api/verdicts/bulk", { items: all.slice(i, i + 100) })).saved;
  return saved;
}

// Put this phone's library and the account's backup together, losing nothing on either side (Restore replaces; this doesn't):
// the account's titles are merged into this phone, the result is saved to the account, and your existing verdicts are shared.
// → { fromAccount: titles that came from the account, verdicts: verdicts shared, version }
export async function combineWithAccount() {
  const r = await request("GET", "/api/sync");
  let fromAccount = 0;
  if (r.data) {
    const m = await mergeData(r.data);
    if (m.error) throw new ApiError(0, m.error);
    fromAccount = m.added;
    await writeKey(SYNC_KEY, String(r.version)); // now this phone has seen the account's latest, so saving it back is allowed
  }
  const version = await pushBackup();
  const verdicts = await shareAllVerdicts();
  return { fromAccount, verdicts, version };
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

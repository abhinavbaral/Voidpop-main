// NEW ANNOUNCEMENTS — anime newly announced on AniList. Each one stays in the
// list for 7 days from when VoidPop first saw it, then drops off.
//
// AniList doesn't publish an "announced on" date, so the date is when this
// device first saw the title among AniList's newest not-yet-released entries.
// The first time you open the page, everything current starts its week at once.

import { fetchNewlyAnnounced } from "../api/anilist.js";
import { readKey, writeKey } from "../backend/storage.js";

const KEY = "voidation:announced:v1";
export const ANNOUNCED_DAYS = 7;
const WEEK = ANNOUNCED_DAYS * 864e5;

async function readSaved() {
  try { return JSON.parse((await readKey(KEY)) || "null") || { seen: {}, items: {} }; } catch { return { seen: {}, items: {} }; }
}

// [{ item, seenAt }], newest announcement first. Works offline from what was saved.
export async function loadAnnounced() {
  const saved = await readSaved();
  const now = Date.now();
  try {
    const fresh = await fetchNewlyAnnounced();
    fresh.forEach((it) => {
      if (!saved.seen[it.id]) saved.seen[it.id] = now;
      saved.items[it.id] = it; // keep the latest details (date, poster…)
    });
  } catch { /* offline or AniList busy: show what was saved */ }
  // forget anything past its week (but remember it was seen, so it never comes back)
  Object.keys(saved.items).forEach((id) => { if (now - saved.seen[id] > WEEK) delete saved.items[id]; });
  Object.keys(saved.seen).forEach((id) => { if (now - saved.seen[id] > 90 * 864e5) delete saved.seen[id]; });
  await writeKey(KEY, JSON.stringify(saved));
  return Object.values(saved.items)
    .map((item) => ({ item, seenAt: saved.seen[item.id] }))
    .sort((a, b) => b.seenAt - a.seenAt || b.item.id - a.item.id);
}

// "3 days left" for each announcement
export function daysLeft(seenAt, now = Date.now()) {
  return Math.max(1, Math.ceil((seenAt + WEEK - now) / 864e5));
}

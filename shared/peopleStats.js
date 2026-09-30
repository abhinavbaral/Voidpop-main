// Statistics → "Your people" (idea from AniList's stats): the genres,
// studios, voice actors, directors and creators that show up most across
// your library. Counts are titles in your library (Plan to Watch/Read left
// out), never scores.
//
// Credits come from AniList once per title and are kept on this device, so
// opening Statistics again only asks for titles added since. Older than
// 60 days: asked again, in case AniList filled in missing staff.

import { readKey, writeKey } from "./backend/storage.js";
import { getLibrary } from "./backend/store.js";
import { fetchCredits } from "./api/anilist.js";

const KEY = "voidation:credits:v1";
const STALE_MS = 60 * 864e5;

// staff roles we group; anything else (animation director, key animation…) is left out
const DIRECTOR = /^director$/i;
const CREATOR = /^(original creator|original story|story & art|story and art|story|art|original work)\b/i;

export const PEOPLE_KINDS = [
  { key: "genres", label: "Genres" },
  { key: "studios", label: "Studios" },
  { key: "voices", label: "Voice actors" },
  { key: "directors", label: "Directors" },
  { key: "creators", label: "Creators" },
];

async function loadCredits() {
  try { return JSON.parse((await readKey(KEY)) || "{}"); } catch { return {}; }
}

// Pure: turn library entries + credits into ranked lists. Exported for tests.
export function tallyPeople(entries, credits, limit = 10) {
  const counted = entries.filter((e) => e.status !== "plan");
  const tally = { genres: new Map(), studios: new Map(), voices: new Map(), directors: new Map(), creators: new Map() };
  const add = (kind, key, base, item) => {
    const row = tally[kind].get(key) || { ...base, titles: [] };
    if (!row.titles.some((t) => t.id === item.id && t.segment === item.segment)) row.titles.push(item);
    tally[kind].set(key, row);
  };
  for (const e of counted) {
    const item = e.item;
    (item.genres || []).forEach((g) => add("genres", g, { name: g }, item));
    const c = credits[`${item.segment}:${item.id}`];
    if (!c) continue;
    c.studios.forEach((st) => add("studios", st.id, { id: st.id, name: st.name }, item));
    c.voices.forEach((v) => add("voices", v.id, v, item));
    c.staff.forEach((p) => {
      const role = p.role.replace(/\s*\(.*\)$/, "");
      if (item.segment === "anime" && DIRECTOR.test(role)) add("directors", p.id, { id: p.id, name: p.name, image: p.image }, item);
      else if (CREATOR.test(role)) add("creators", p.id, { id: p.id, name: p.name, image: p.image }, item);
    });
  }
  const out = {};
  for (const [kind, map] of Object.entries(tally)) {
    out[kind] = [...map.values()]
      .sort((a, b) => b.titles.length - a.titles.length || a.name.localeCompare(b.name))
      .slice(0, limit)
      .map((r) => ({ ...r, count: r.titles.length }));
  }
  out.counted = counted.length;
  return out;
}

// onProgress(done, total) while fetching; works offline with what's saved.
export async function loadPeopleStats({ onProgress } = {}) {
  const entries = Object.values(await getLibrary());
  const credits = await loadCredits();
  const now = Date.now();
  const need = entries.filter((e) => e.status !== "plan")
    .map((e) => `${e.item.segment}:${e.item.id}`)
    .filter((k) => !credits[k] || now - credits[k].at > STALE_MS);
  let missing = 0;
  // AniList ids are unique across anime and manga, so one request covers both
  const ids = [...new Set(need.map((k) => k.split(":")[1]))];
  for (let i = 0; i < ids.length; i += 20) {
    onProgress?.(i, ids.length);
    try {
      const got = await fetchCredits(ids.slice(i, i + 20));
      for (const k of need) {
        const id = k.split(":")[1];
        if (got[id]) credits[k] = { at: now, ...got[id] };
      }
      await writeKey(KEY, JSON.stringify(credits));
    } catch {
      missing = ids.length - i; // offline or AniList busy: show what we have
      break;
    }
  }
  onProgress?.(ids.length, ids.length);
  return { ...tallyPeople(entries, credits), missing };
}

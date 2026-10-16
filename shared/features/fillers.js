// Filler guide logic: read the filler database (data/fillers.js), find the
// next filler block, count what you could skip, and work with the skipped
// episode ranges saved on a library entry (entry.skipped, e.g. [[54, 61]]).
// Plain functions, no storage: store.js and the screens build on them.
import FILLER_DB from "../data/fillers.js";

export const FILLER_LABEL = { filler: "Filler", animeCanon: "Anime canon", mixed: "Mixed canon/filler" };
// the types you are allowed to skip (mixed episodes have real story in them)
export const SKIPPABLE = ["filler", "animeCanon"];

/* ---------- ranges: [[54, 61], [98, 98]] ---------- */

export function mergeRanges(ranges) {
  const sorted = (ranges || []).map(([a, b]) => [a, b]).sort((x, y) => x[0] - y[0]);
  const out = [];
  for (const [a, b] of sorted) {
    const last = out[out.length - 1];
    if (last && a <= last[1] + 1) last[1] = Math.max(last[1], b);
    else out.push([a, b]);
  }
  return out;
}

// "54-61, 98, 131-133" → [[54, 61], [98, 98], [131, 133]]. Sorted and merged; anything that isn't a range is ignored.
export function parseRanges(text) {
  const out = [];
  String(text ?? "").split(",").forEach((part) => {
    const m = part.trim().match(/^(\d+)(?:\s*[-–]\s*(\d+))?$/);
    if (!m) return;
    const a = Number(m[1]);
    const b = m[2] ? Number(m[2]) : a;
    if (a >= 1 && b >= a) out.push([a, b]);
  });
  return mergeRanges(out);
}

export const rangesToString = (ranges) => (ranges || []).map(([a, b]) => (a === b ? `${a}` : `${a}-${b}`)).join(",");
export const inRanges = (ranges, n) => !!ranges && ranges.some(([a, b]) => n >= a && n <= b);

// how many episodes between from and to (inclusive) the ranges cover
export function countIn(ranges, from, to) {
  if (!ranges || to < from) return 0;
  let n = 0;
  for (const [a, b] of ranges) {
    const lo = Math.max(a, from);
    const hi = Math.min(b, to);
    if (hi >= lo) n += hi - lo + 1;
  }
  return n;
}

export const addRange = (ranges, a, b = a) => mergeRanges([...(ranges || []), [a, b]]);

export function removeRange(ranges, from, to = from) {
  const out = [];
  (ranges || []).forEach(([a, b]) => {
    if (b < from || a > to) { out.push([a, b]); return; }
    if (a < from) out.push([a, from - 1]);
    if (b > to) out.push([to + 1, b]);
  });
  return out;
}

/* ---------- the database ---------- */

let db = FILLER_DB;
const cache = new Map();
export function setFillerDb(next) { db = next || FILLER_DB; cache.clear(); } // tests swap in their own

// null when we have no filler data for this show (or it isn't an anime)
export function fillerFor(item) {
  if (!item || item.segment !== "anime") return null;
  const id = String(item.id);
  if (cache.has(id)) return cache.get(id);
  const raw = db[id];
  const info = raw ? {
    id, name: raw.name || item.title, afl: raw.afl || null,
    filler: parseRanges(raw.filler), animeCanon: parseRanges(raw.animeCanon), mixed: parseRanges(raw.mixed),
  } : null;
  cache.set(id, info);
  return info;
}

export const typeOf = (info, ep) => (inRanges(info.filler, ep) ? "filler" : inRanges(info.animeCanon, ep) ? "animeCanon" : inRanges(info.mixed, ep) ? "mixed" : "canon");
export const canSkip = (info, ep) => !!info && (inRanges(info.filler, ep) || inRanges(info.animeCanon, ep));
export const lastListed = (info) => Math.max(0, ...[...info.filler, ...info.animeCanon, ...info.mixed].map((r) => r[1]));

// the numbers for the guide's header
export function fillerSummary(info, item) {
  const total = item.episodes || lastListed(info);
  const filler = countIn(info.filler, 1, total);
  const animeCanon = countIn(info.animeCanon, 1, total);
  const mixed = countIn(info.mixed, 1, total);
  const skippable = filler + animeCanon;
  return {
    total, filler, animeCanon, mixed, skippable,
    canon: Math.max(0, total - skippable - mixed),
    percent: total ? Math.round((filler / total) * 100) : 0,
    hours: Math.round(((skippable * (item.duration || 24)) / 60) * 10) / 10, // time the skippable episodes would take
  };
}

// every non-canon block in order: [{ type, from, to }]
export function blocksOf(info, total) {
  const out = [];
  [["filler", info.filler], ["animeCanon", info.animeCanon], ["mixed", info.mixed]].forEach(([type, rs]) => rs.forEach(([a, b]) => {
    if (!total || a <= total) out.push({ type, from: a, to: total ? Math.min(b, total) : b });
  }));
  return out.sort((x, y) => x.from - y.from);
}

// The next skippable block you haven't reached: { type, from, to, away } where
// away = canon episodes before it (0 = you are in it or it's next).
export function nextBlock(info, progress, total) {
  const b = blocksOf(info, total).find((x) => SKIPPABLE.includes(x.type) && x.to > progress);
  return b ? { ...b, from: Math.max(b.from, progress + 1), away: Math.max(0, b.from - progress - 1) } : null;
}

// Problems in a database, as readable lines (the builder and the tests run this).
export function checkFillerDb(data) {
  const problems = [];
  Object.entries(data).forEach(([id, raw]) => {
    if (!/^\d+$/.test(id)) problems.push(`${id}: the key must be an AniList id (digits only)`);
    const lists = { filler: parseRanges(raw.filler), animeCanon: parseRanges(raw.animeCanon), mixed: parseRanges(raw.mixed) };
    ["filler", "animeCanon", "mixed"].forEach((k) => {
      const given = String(raw[k] ?? "").split(",").map((s) => s.trim()).filter(Boolean);
      const parsed = rangesToString(lists[k]).split(",").filter(Boolean);
      if (given.length && !parsed.length) problems.push(`${id}: "${k}" has no readable ranges (${raw[k]})`);
    });
    const names = Object.keys(lists);
    for (let i = 0; i < names.length; i++) {
      for (let j = i + 1; j < names.length; j++) {
        lists[names[i]].forEach(([a, b]) => {
          if (countIn(lists[names[j]], a, b)) problems.push(`${id}: ${names[i]} and ${names[j]} overlap around ${a}-${b}`);
        });
      }
    }
  });
  return problems;
}

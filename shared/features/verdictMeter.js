// The community verdict meter: "58% Peak · 28% Dive In · 10% One Time · 4% Void It".
//
// Rules (see Docs/Updates.txt, item 2):
//   - the split stays hidden until MIN_VERDICTS people have given a verdict, so two
//     votes can never look like "50% Void It";
//   - only people who finished or dropped the title count (a verdict from someone
//     who is still on episode 2 says little).
//
// VoidPop has no accounts yet, so there is no real community data. This file is the
// pure maths the UI and a future backend will share; sample data is labelled as such.

import { VERDICTS } from "../backend/store.js";

export const MIN_VERDICTS = 20;

// one-line meaning of each verdict, shown next to the bars
export const VERDICT_BLURB = {
  peak: "An all-time favourite",
  divein: "Worth your time",
  onetime: "A decent watch",
  voidit: "Not for me",
};

// Votes that count: [{ verdict, status }] → { verdictKey: n }. Only Completed and Dropped.
export function countVotes(votes) {
  const counts = {};
  for (const v of votes || []) {
    if (v.status !== "completed" && v.status !== "dropped") continue;
    if (!VERDICTS.some((x) => x.key === v.verdict)) continue;
    counts[v.verdict] = (counts[v.verdict] || 0) + 1;
  }
  return counts;
}

// Percentages that always add up to 100 (largest-remainder rounding).
function percents(counts, total) {
  const raw = VERDICTS.map((v) => ({ key: v.key, exact: ((counts[v.key] || 0) / total) * 100 }));
  const out = Object.fromEntries(raw.map((r) => [r.key, Math.floor(r.exact)]));
  let left = 100 - Object.values(out).reduce((a, b) => a + b, 0);
  [...raw].sort((a, b) => (b.exact - Math.floor(b.exact)) - (a.exact - Math.floor(a.exact)))
    .forEach((r) => { if (left > 0) { out[r.key] += 1; left -= 1; } });
  return out;
}

// counts → { total, ready, remaining, rows }. `rows` is empty until `ready`.
export function communitySplit(counts, min = MIN_VERDICTS) {
  const total = VERDICTS.reduce((n, v) => n + (counts?.[v.key] || 0), 0);
  if (total < min) return { total, ready: false, remaining: min - total, rows: [] };
  const pct = percents(counts, total);
  return {
    total, ready: true, remaining: 0,
    rows: VERDICTS.map((v) => ({ key: v.key, label: v.label, color: v.color, blurb: VERDICT_BLURB[v.key], count: counts[v.key] || 0, pct: pct[v.key] })),
  };
}

// "40% Void It (900 people)" style line for the biggest slice
export function topVerdict(split) {
  if (!split.ready) return null;
  return [...split.rows].sort((a, b) => b.count - a.count)[0];
}

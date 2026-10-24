// The three community rows of Explore, decided from how people split their Void Verdicts on each title.
//
//   Most loved      99–100% of the verdicts are Peak or Dive In
//   Best out there  70%+ of the verdicts are Peak (and the title is not already in Most loved,
//                   so a title never shows twice across the two rows)
//   Popular in town 70%+ of the verdicts are anything but Void It, the most-voted titles first
//
// A title only counts once MIN_VERDICTS people who finished or dropped it have given a verdict (the same
// rule as the verdict meter, so two votes can never make a title "100% loved"). No scores anywhere: every
// number here is a share of verdicts.
//
// Plain functions: no network, no storage. api/community.js fetches the counts, this file ranks them.
// Each row mixes anime, manga, novels, movies and TV (taken in turns, best first within each kind).

import { interleave } from "./exploreMix.js";
import { MIN_VERDICTS } from "./verdictMeter.js";

export const BEST_PEAK_PERCENT = 70;
export const LOVED_PERCENT = 99;
export const POPULAR_PERCENT = 70;
const KINDS = ["anime", "manga", "novel", "movie", "tv"];

// counts { peak, divein, onetime, voidit } → how many people and each share as a fraction (0..1)
export function shares(counts) {
  const n = (k) => Number(counts?.[k]) || 0;
  const total = n("peak") + n("divein") + n("onetime") + n("voidit");
  if (!total) return { total: 0, peak: 0, peakDivein: 0, notVoid: 0 };
  return { total, peak: n("peak") / total, peakDivein: (n("peak") + n("divein")) / total, notVoid: (total - n("voidit")) / total };
}

// whole-number maths for the thresholds, so 7 of 10 is exactly 70% and never 69.999…
const atLeast = (count, total, percent) => count * 100 >= percent * total;

// one title per kind in turn, keeping each kind's own order
const mixKinds = (list) => interleave(KINDS.map((k) => list.filter((it) => it.segment === k)));

// titles: [{ segment, id, title, image, counts }] (what GET /api/rankings returns)
// → { best, popular, loved }: arrays of Explore items ({ segment, id, title, image, imageSmall, community: { total, … } })
export function rankCommunity(titles, { min = MIN_VERDICTS } = {}) {
  const rows = [];
  for (const t of titles || []) {
    if (!t || !t.title || !t.segment || t.id == null) continue; // nothing to show for it
    const s = shares(t.counts);
    if (s.total < min) continue;
    const n = (k) => Number(t.counts?.[k]) || 0;
    rows.push({
      item: { segment: t.segment, id: t.id, title: t.title, image: t.image || null, imageSmall: t.image || null, community: { total: s.total, peak: s.peak, peakDivein: s.peakDivein } },
      s,
      peakN: n("peak"), peakDiveinN: n("peak") + n("divein"), notVoidN: s.total - n("voidit"),
    });
  }
  const isLoved = (r) => atLeast(r.peakDiveinN, r.s.total, LOVED_PERCENT);
  const take = (list, cmp) => mixKinds([...list].sort(cmp).map((r) => r.item));

  const loved = take(rows.filter(isLoved), (a, b) => b.s.peakDivein - a.s.peakDivein || b.s.peak - a.s.peak || b.s.total - a.s.total);
  const best = take(rows.filter((r) => !isLoved(r) && atLeast(r.peakN, r.s.total, BEST_PEAK_PERCENT)), (a, b) => b.s.peak - a.s.peak || b.s.total - a.s.total);
  const popular = take(rows.filter((r) => atLeast(r.notVoidN, r.s.total, POPULAR_PERCENT)), (a, b) => b.s.total - a.s.total || b.s.notVoid - a.s.notVoid);
  return { best, popular, loved };
}

// Mixing helpers for Explore: taking anime, manga, novels, movies and TV in turns, building a
// "like this one" list that reaches across all five kinds, and picking the Billboard title.
//
// Plain functions: no storage, no network, no screens. Every list is an array of items
// ({ id, segment, title, genres, banner, … }); a missing list is the same as an empty one, because
// movies and TV load a moment after anime and a tile must never break while it waits.

const keyOf = (it) => `${it.segment}:${it.id}`;
const KINDS = ["anime", "manga", "novel", "movie", "tv"];

// Takes one show from each list in turn (first of every list, then the second of every list, …) so no
// kind floods the result. A show that is in more than one list is kept once. limit = how many to return.
export function interleave(lists, limit = Infinity) {
  const queues = (lists || []).map((l) => (Array.isArray(l) ? l : []));
  const at = queues.map(() => 0);
  const seen = new Set();
  const out = [];
  let moved = true;
  while (moved && out.length < limit) {
    moved = false;
    for (let q = 0; q < queues.length && out.length < limit; q++) {
      while (at[q] < queues[q].length) { // this list's next show we don't already have
        const it = queues[q][at[q]++];
        if (!it || seen.has(keyOf(it))) continue;
        seen.add(keyOf(it));
        out.push(it);
        moved = true;
        break;
      }
    }
  }
  return out;
}

const genresOf = (it) => new Set((it?.genres || []).map((g) => String(g).toLowerCase()));

// "Peak like One Piece": the title's own recommendations, with a few anime, manga, novels, movies and
// series that share its genres woven in (one after every `every` of its own), so the tile reaches past
// the title's own kind.
//   source = the title the tile is "like", recs = its recommendations (raw, may be empty or missing),
//   pools = { anime, manga, novel, movie, tv }: popular shows of each kind to draw the extras from.
// Never contains the source itself or the same show twice. Without genres on the source there is
// nothing to match on, so it is just the recommendations.
export function likeMix(source, recs, pools = {}, { perKind = 2, every = 3 } = {}) {
  const seen = new Set(source ? [keyOf(source)] : []);
  const own = [];
  for (const it of recs || []) {
    if (it && !seen.has(keyOf(it))) { seen.add(keyOf(it)); own.push(it); }
  }
  const mine = genresOf(source);
  if (!mine.size) return own;

  // per kind: the shows sharing the most genres with the source (most popular first among equals)
  const byKind = KINDS.map((kind) => (pools?.[kind] || [])
    .map((it, i) => ({ it, i, shared: it && !seen.has(keyOf(it)) ? [...genresOf(it)].filter((g) => mine.has(g)).length : 0 }))
    .filter((x) => x.shared > 0)
    .sort((a, b) => b.shared - a.shared || a.i - b.i)
    .slice(0, perKind)
    .map((x) => x.it));
  const extras = interleave(byKind);

  const out = [];
  let next = 0;
  own.forEach((it, i) => {
    out.push(it);
    if ((i + 1) % every === 0 && next < extras.length) out.push(extras[next++]);
  });
  while (next < extras.length) out.push(extras[next++]); // few recommendations: the extras follow
  return out;
}

// The Billboard at the top of Explore: a trending anime, movie or TV series, never manga or a novel.
// It needs a wide banner picture and must already be out. The same seed always gives the same title; Explore
// passes a new seed on every refresh. Returns null when nothing qualifies (the screen then falls back to
// buildExplore's pick). known = optional Set of "segment:id" keys to leave out (your library, Excited).
export function billboardPick(pools, seed = 0, known = new Set()) {
  if (!pools) return null;
  const ok = (it) => it && it.banner && !it.unreleased && !known.has(keyOf(it));
  const list = interleave([pools.trA, pools.trMv, pools.trTv].map((l) => (l || []).filter(ok)), 12);
  return list.length ? list[(seed >>> 0) % list.length] : null;
}

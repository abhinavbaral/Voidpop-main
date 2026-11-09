// ANIME THIS WEEK (Schedule) — every episode of the calendar week, Monday to Sunday, aired or not yet, plus
// the aired episodes of shows you're Watching that you still haven't watched, until you've watched them.
// Pure functions: the fetching is loadAnimeThisWeek (upcoming.js), the drawing is the app's AnimeThisWeek.

import { yourShows } from "../backend/store.js";
import { dayKey } from "./upcoming.js";

// episodes: [{ item, episode, airingAt }] from loadAnimeThisWeek. lib: the library, { "anime:1": entry }.
// Returns
//   earlier   Watching shows with aired episodes from BEFORE this week you haven't watched: [{ item, entry, earlier }]
//             (they stay until you watch them; a show leaves Schedule 2 weeks after its last episode, as everywhere)
//   upcoming  today and the days still to come, in order: [{ key, date, isToday, rows }]
//   past      the days already gone this week: [{ key, date, isToday, rows }]
//   rows      [{ item, episode, airingAt, aired, watched, entry }], by air time
export function buildAnimeWeek(episodes, lib, now = Date.now()) {
  const byId = {};
  Object.values(lib || {}).forEach((e) => { if (e.item?.segment === "anime") byId[e.item.id] = e; });
  const nowS = now / 1000;
  const today = dayKey(new Date(now));

  const rows = [...episodes].sort((a, b) => a.airingAt - b.airingAt).map((s) => {
    const entry = byId[s.item.id] || null;
    const aired = s.airingAt <= nowS;
    const watched = aired && !!entry && (entry.status === "completed" || (entry.progress || 0) >= s.episode);
    return { ...s, aired, watched, entry };
  });

  const byDay = {};
  rows.forEach((r) => {
    const d = new Date(r.airingAt * 1000);
    const key = dayKey(d);
    (byDay[key] = byDay[key] || { key, date: d, isToday: key === today, rows: [] }).rows.push(r);
  });
  const days = Object.values(byDay).sort((a, b) => a.key.localeCompare(b.key));

  // the fresh copies from this week's fetch know the latest next episode, so "aired so far" is right
  const fresh = Object.fromEntries(rows.map((r) => [r.item.id, r.item]));
  const earlier = yourShows(lib || {}, fresh, now)
    .filter((x) => x.pending > 0)
    .map((x) => {
      const thisWeek = rows.filter((r) => r.item.id === x.item.id && r.aired && !r.watched).length;
      return { item: x.item, entry: x.entry, earlier: x.pending - thisWeek };
    })
    .filter((x) => x.earlier > 0)
    .sort((a, b) => b.earlier - a.earlier);

  return {
    earlier,
    upcoming: days.filter((d) => d.key >= today),
    past: days.filter((d) => d.key < today),
    total: rows.length,
  };
}

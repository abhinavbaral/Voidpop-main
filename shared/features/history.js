// History, like YouTube's watch history: one timeline of what you did and what is waiting.
//   - watched: episodes/chapters you marked (from your watch log), one row per title per day
//   - status:  titles you Completed or Dropped
//   - aired:   episodes that aired in the last 14 days and you haven't watched yet ("To watch")
// Plain functions: the History screen shows what buildHistory() returns.
import { kindOf, totalFor } from "../backend/store.js";
import { dayLabel } from "../lib/format.js";

export const HISTORY_FILTERS = [
  { key: "all", label: "All" },
  { key: "towatch", label: "To watch" },
  { key: "watched", label: "Watched" },
  { key: "anime", label: "Anime" },
  { key: "manga", label: "Manga" },
  { key: "novel", label: "Novels" },
];

const startOfDay = (ms) => new Date(new Date(ms).setHours(0, 0, 0, 0)).getTime();
const fraction = (item, progress) => {
  const total = totalFor(item);
  return total ? Math.min(1, (progress || 0) / total) : 0;
};

// log: [[ms, "anime:123", change, source]] oldest first (getLog), library: { "anime:123": entry },
// aired: [{ item, episode, airingAt }] (fetchRecentEpisodes), labels: anime id → status name,
// progress: anime id → episodes watched, hidden: Set of ids you removed from history.
// → [{ label: "Today", data: [item…] }] newest first. Each item has id, type, at (ms), item, fraction and what to say.
export function buildHistory({ log = [], library = {}, aired = [], labels = {}, progress = {}, hidden = new Set(), filter = "all", query = "", now = Date.now(), limit = 400 }) {
  const items = [];
  const perDay = new Map();
  // Removing a "watched" row hides what was logged for that title that day UP TO that moment. Anything you
  // watch afterwards (even the same day) is a new row, so it can't bring the removed episodes back.
  const cutoff = new Map();
  hidden.forEach((id) => {
    if (!id.startsWith("w:")) return;
    const [, ts, ...rest] = id.split(":");
    const k = `${rest.join(":")}|${startOfDay(Number(ts))}`;
    cutoff.set(k, Math.max(cutoff.get(k) || 0, Number(ts)));
  });

  for (let i = log.length - 1; i >= 0 && items.length < limit; i--) { // newest first, so the first one of a day is its latest
    const [ts, key, change, source] = log[i];
    const entry = library[key];
    if (!entry) continue; // removed from your library: nothing to show
    const src = String(source);
    if (src.startsWith("status:")) {
      const status = src.slice(7);
      if (status === "completed" || status === "dropped") {
        items.push({ id: `s:${ts}:${key}`, type: "status", at: ts, item: entry.item, status, fraction: status === "completed" ? 1 : fraction(entry.item, entry.progress) });
      }
      continue;
    }
    if (src === "complete" || change <= 0) continue; // filled in by marking Completed, or an undo
    const day = `${key}|${startOfDay(ts)}`;
    if (ts <= (cutoff.get(day) || 0)) continue; // you removed this one
    const found = perDay.get(day);
    if (found) { found.count += change; continue; }
    const it = { id: `w:${ts}:${key}`, type: "watched", at: ts, item: entry.item, count: change, fraction: fraction(entry.item, entry.progress), status: entry.status };
    perDay.set(day, it);
    items.push(it);
  }

  aired.forEach((s) => {
    if ((progress[s.item.id] || 0) >= s.episode) return; // watched: it is in the log above
    items.push({ id: `a:${s.item.id}:${s.episode}`, type: "aired", at: s.airingAt * 1000, item: s.item, episode: s.episode, label: labels[s.item.id] || "", fraction: fraction(s.item, progress[s.item.id]) });
  });

  const q = query.trim().toLowerCase();
  const shown = items
    .filter((x) => !hidden.has(x.id))
    .filter((x) => (filter === "towatch" ? x.type === "aired" : filter === "watched" ? x.type !== "aired" : ["anime", "manga", "novel"].includes(filter) ? kindOf(x.item) === filter : true))
    .filter((x) => !q || x.item.title.toLowerCase().includes(q))
    .sort((a, b) => b.at - a.at);

  const sections = [];
  shown.forEach((x) => {
    const label = dayLabel(Math.floor(x.at / 1000), now);
    const last = sections[sections.length - 1];
    if (last && last.label === label) last.data.push(x);
    else sections.push({ label, data: [x] });
  });
  return sections;
}

// What a row says under the title
export function historyText(x, now = Date.now()) {
  const unit = x.item.segment === "manga" ? "chapter" : "episode";
  if (x.type === "aired") return { line1: `Episode ${x.episode}`, line2: x.label || "" };
  if (x.type === "status") return { line1: x.status === "completed" ? "Completed" : "Dropped", line2: "" };
  return { line1: `${x.item.segment === "manga" ? "Read" : "Watched"} ${x.count} ${unit}${x.count === 1 ? "" : "s"}`, line2: "" };
}

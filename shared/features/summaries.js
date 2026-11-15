// FILE: shared/features/summaries.js — the numbers behind History's "this week" card and Library's totals strip. Pure.

const DAY_MS = 86400000;
const startOfDay = (ms) => { const d = new Date(ms); d.setHours(0, 0, 0, 0); return d.getTime(); };
const SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// log: the watch log, [time, "segment:id", change, source] rows. The last 7 days (today included), oldest first.
// -> { total: units marked this week, titles: how many different titles, days: [{ label, count, today }] }
export function weekSummary(log, now = Date.now()) {
  const today = startOfDay(now);
  const first = today - 6 * DAY_MS;
  const days = Array.from({ length: 7 }, (_, i) => ({ label: SHORT[new Date(first + i * DAY_MS).getDay()], count: 0, today: i === 6 }));
  const titles = new Set();
  let total = 0;
  for (const row of Array.isArray(log) ? log : []) {
    const [time, key, change] = row || [];
    if (!(change > 0) || time < first || time > now) continue; // only progress, not status changes (change 0) or undo
    // a game logs minutes: it counts one per started hour, so 90 minutes of play doesn't outweigh 90 episodes
    const units = String(key).startsWith("game:") ? Math.ceil(change / 60) : change;
    days[Math.floor((startOfDay(time) - first) / DAY_MS)].count += units;
    titles.add(key);
    total += units;
  }
  return { total, titles: titles.size, days };
}

// entries: library entries ({ status, addedAt }). -> { titles, done, thisYear }
export function libraryStats(entries, now = Date.now()) {
  const year = new Date(now).getFullYear();
  let done = 0, thisYear = 0;
  for (const e of entries) {
    if (e.status === "completed" || e.status === "rewatching") done++;
    if (e.addedAt && new Date(e.addedAt).getFullYear() === year) thisYear++;
  }
  return { titles: entries.length, done, thisYear };
}

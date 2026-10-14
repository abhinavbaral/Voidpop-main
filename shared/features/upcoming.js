// UPCOMING — the calendar of premieres, "Airing soon" and "Latest premieres".
import { fetchPremieres, fetchAiringSchedule } from "../api/anilist.js";

const ymd = (d) => d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
export const dayKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

// Premieres in one month: { "2026-10-04": [items…] }. Only titles with an exact start day.
export async function loadMonthPremieres(year, month) {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const items = await fetchPremieres(ymd(first) - 1, ymd(last) + 1, { sort: "START_DATE", pages: 4 });
  const byDay = {};
  items.forEach((it) => {
    if (!it.date || it.dateLabel?.split(" ").length < 3) return; // month-only dates ("Oct 2026") have no day
    const [y, m] = it.date.split("-").map(Number);
    if (y !== year || m !== month + 1) return;
    (byDay[it.date] = byDay[it.date] || []).push(it);
  });
  return byDay;
}

// Weeks of the month for the calendar grid, Monday first: [[Date|null × 7], …]
export function monthGrid(year, month) {
  const first = new Date(year, month, 1);
  const days = new Date(year, month + 1, 0).getDate();
  const lead = (first.getDay() + 6) % 7; // Monday = 0
  const cells = [...Array(lead).fill(null), ...Array.from({ length: days }, (_, i) => new Date(year, month, i + 1))];
  while (cells.length % 7) cells.push(null);
  return Array.from({ length: cells.length / 7 }, (_, w) => cells.slice(w * 7, w * 7 + 7));
}

// Episodes airing in the next `hours` hours, soonest first.
export async function loadAiringSoon(hours = 24) {
  const now = Date.now() / 1000;
  return (await fetchAiringSchedule(2)).filter((s) => s.airingAt > now && s.airingAt < now + hours * 3600);
}

// Release calendar: every episode airing in the next 7 days, grouped by your
// local day: { "2026-09-30": [{ item, episode, airingAt }, …], … } (soonest first)
export async function loadAiringWeek(days = 7) {
  const now = Date.now() / 1000;
  const out = {};
  (await fetchAiringSchedule(days)).filter((s) => s.airingAt > now).forEach((s) => {
    const k = dayKey(new Date(s.airingAt * 1000));
    (out[k] = out[k] || []).push(s);
  });
  Object.values(out).forEach((list) => list.sort((a, b) => a.airingAt - b.airingAt));
  return out;
}

// Anime whose first episode came out in the last `days` days, newest first.
export async function loadLatestPremieres(days = 21) {
  const today = new Date();
  const from = new Date(Date.now() - days * 864e5);
  const items = await fetchPremieres(ymd(from) - 1, ymd(today) + 1, { sort: "START_DATE_DESC", pages: 2 });
  return items.filter((it) => !it.unreleased);
}

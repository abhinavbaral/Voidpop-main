// Display helpers for title metadata: release dates and the creator line.

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// "7 Apr 2013" / "Apr 2013" / "2013" depending on how much the source knows.
export function formatDateParts(year, month, day) {
  if (!year) return null;
  if (!month) return String(year);
  if (!day) return `${MONTHS[month - 1]} ${year}`;
  return `${day} ${MONTHS[month - 1]} ${year}`;
}

// Release label for any item, including library snapshots saved before
// items carried a dateLabel.
export function releaseLabel(item) {
  if (item?.dateLabel) return item.dateLabel;
  if (!item?.date) return "TBA";
  const [y, m, d] = item.date.split("-").map(Number);
  // old AniList snapshots defaulted missing month/day to 1 — only trust the year
  if (item.segment === "anime" || item.segment === "manga") return String(y);
  return formatDateParts(y, m, d);
}

export const yearOf = (item) => (item?.date ? Number(item.date.slice(0, 4)) : null);

// ---- airing countdowns (anime) ----

// Seconds until an AniList airingAt (unix seconds). Negative once it has aired.
export const secondsUntil = (airingAt, now = Date.now()) => airingAt - Math.floor(now / 1000);

// "2d 4h" → "4h 12m" → "12m 05s" as it gets closer; "Airing now" for the first
// hour after it goes out (streams lag a bit behind the broadcast).
export function formatCountdown(airingAt, now = Date.now()) {
  const s = secondsUntil(airingAt, now);
  if (s <= 0) return s > -3600 ? "Airing now" : "Aired";
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m`;
  return `${m}m ${String(sec).padStart(2, "0")}s`;
}

// Day heading for the schedule: "Today", "Tomorrow", then "Wed 1 Oct".
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export function dayLabel(airingAt, now = Date.now()) {
  const day = new Date(airingAt * 1000);
  const start = (t) => new Date(new Date(t).setHours(0, 0, 0, 0)).getTime();
  const diff = Math.round((start(day) - start(now)) / 864e5);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  return `${DAYS[day.getDay()]} ${day.getDate()} ${MONTHS[day.getMonth()]}`;
}

export const airTime = (airingAt, clock24 = false) =>
  new Date(airingAt * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: !clock24 });

// "aired 3h ago" / "aired 2 days ago" for the History feed.
export function airedAgo(airingAt, now = Date.now()) {
  const s = Math.max(0, Math.floor(now / 1000) - airingAt);
  if (s < 3600) return `aired ${Math.max(1, Math.floor(s / 60))} min ago`;
  if (s < 86400) return `aired ${Math.floor(s / 3600)}h ago`;
  const d = Math.floor(s / 86400);
  return `aired ${d} day${d > 1 ? "s" : ""} ago`;
}

// "Wed 1 Oct, 8:30 PM GMT+5:45": a full air time for a share card, with the
// time zone, since whoever sees the image may live somewhere else.
export function shareAirTime(airingAt, clock24 = false) {
  const d = new Date(airingAt * 1000);
  try {
    return new Intl.DateTimeFormat(undefined, {
      weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit",
      hour12: !clock24, timeZoneName: "short",
    }).format(d);
  } catch {
    return d.toString().slice(0, 21);
  }
}

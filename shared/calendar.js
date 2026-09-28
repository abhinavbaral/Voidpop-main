// "Add to calendar" for an airing anime: one weekly event per remaining
// episode, starting at the next episode's real air time. Free: no API, no key.
//   - Google Calendar link (works anywhere)
//   - .ics file (Apple Calendar, Outlook, and Google too)
//   - the app uses the phone's own "new event" screen (see app/src/lib/calendar.js)
// If a show takes a break, the calendar won't know; Voidation's countdown will.

const LENGTH_MIN = 24; // a TV episode
const UNKNOWN_RUN = 12; // weeks to add when the episode count isn't announced

export function calendarPlan(item) {
  const next = item.nextEpisode;
  if (!next) return null;
  const remaining = item.episodes ? item.episodes - next.episode + 1 : UNKNOWN_RUN;
  const count = Math.max(1, Math.min(remaining, 52));
  const start = new Date(next.airingAt * 1000);
  const end = new Date(start.getTime() + LENGTH_MIN * 60000);
  const last = next.episode + count - 1;
  return {
    title: `${item.title} — new episode`,
    notes: `Episodes ${next.episode}${count > 1 ? `–${last}` : ""}${item.episodes ? ` of ${item.episodes}` : ""}, weekly. ` +
      `Times are from AniList; if the show takes a break, check Voidation for the new date.${item.url ? `\n${item.url}` : ""}`,
    start, end, count,
    known: !!item.episodes,
  };
}

const utc = (d) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, ""); // 20261001T123000Z

export function googleCalendarUrl(item) {
  const p = calendarPlan(item);
  if (!p) return null;
  const q = new URLSearchParams({
    action: "TEMPLATE",
    text: p.title,
    details: p.notes,
    ...(p.count > 1 ? { recur: `RRULE:FREQ=WEEKLY;COUNT=${p.count}` } : {}),
  });
  // dates keeps its "/" unencoded, the form Google documents
  return `https://calendar.google.com/calendar/render?${q}&dates=${utc(p.start)}/${utc(p.end)}`;
}

// iCalendar text escaping: backslash, comma, semicolon, newline
const esc = (s) => String(s).replace(/\\/g, "\\\\").replace(/([,;])/g, "\\$1").replace(/\n/g, "\\n");

export function icsFor(item) {
  const p = calendarPlan(item);
  if (!p) return null;
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Voidation//Anime countdown//EN",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:voidation-${item.segment}-${item.id}-${item.nextEpisode.episode}@voidation`,
    `DTSTAMP:${utc(new Date())}`,
    `DTSTART:${utc(p.start)}`,
    `DTEND:${utc(p.end)}`,
    ...(p.count > 1 ? [`RRULE:FREQ=WEEKLY;COUNT=${p.count}`] : []),
    `SUMMARY:${esc(p.title)}`,
    `DESCRIPTION:${esc(p.notes)}`,
    ...(item.url ? [`URL:${item.url}`] : []),
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    `DESCRIPTION:${esc(p.title)}`,
    "TRIGGER:-PT10M",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.join("\r\n") + "\r\n";
}

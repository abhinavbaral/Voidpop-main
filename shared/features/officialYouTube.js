// "On YouTube · <channel>": shown only when AniList links a YouTube channel that
// is on the list below, i.e. a channel that licenses what it posts. Everything
// else on YouTube (reuploads, unknown channels, dub channels) is hidden.
//
// Information only, like "Available on": no links to episodes.
//
// To trust another channel, add it here. `match` is compared with the link's
// note and URL, ignoring case, spaces and punctuation.
export const LICENSED_YOUTUBE_CHANNELS = [
  { name: "Muse Asia", match: ["muse asia", "museasia", "muse communication"] },
  { name: "Ani-One Asia", match: ["ani-one asia", "anioneasia", "ani-one"] },
];

const flat = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");

// links: AniList's externalLinks. Returns channel names, e.g. ["Muse Asia"].
export function officialYouTube(links) {
  const out = [];
  for (const l of Array.isArray(links) ? links : []) {
    if (!l || l.isDisabled || !l.url) continue;
    const onYouTube = String(l.site || "").toLowerCase() === "youtube" || /youtu(\.be|be\.com)/i.test(l.url);
    if (!onYouTube) continue;
    const raw = `${l.notes || ""} ${l.url}`;
    if (/dub/i.test(raw)) continue; // dub channels are never shown
    const text = flat(raw);
    const channel = LICENSED_YOUTUBE_CHANNELS.find((c) => c.match.some((m) => text.includes(flat(m))));
    if (channel && !out.includes(channel.name)) out.push(channel.name);
  }
  return out;
}

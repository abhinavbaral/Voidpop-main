// FILE: shared/api/news.js — fetches the news RSS feeds. NOT shared/features/news.js, which turns feeds into a clean list.
// The only file that fetches news. A few public RSS feeds; each fails on its own, so one site being down
// never empties the list. The result is kept on the device for 15 minutes (and used as-is when you're offline).

import { readKey, writeKey } from "../backend/storage.js";
import { parseFeed, mergeNews } from "../features/news.js";

export const NEWS_FEEDS = [
  { id: "ann", name: "Anime News Network", url: "https://www.animenewsnetwork.com/all/rss.xml?ann-edition=w" },
  { id: "mal", name: "MyAnimeList", url: "https://myanimelist.net/rss/news.xml" },
  { id: "animecorner", name: "Anime Corner", url: "https://animecorner.me/feed/" },
];

const KEY = "voidpop:news:v1";
const FRESH_MS = 15 * 60 * 1000;
const TIMEOUT_MS = 9000;

async function fetchText(url) {
  const ctl = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timer = ctl ? setTimeout(() => ctl.abort(), TIMEOUT_MS) : null;
  try {
    const res = await fetch(url, { signal: ctl?.signal, headers: { Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, */*" } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    if (timer) clearTimeout(timer);
  }
}

// → { items, failed: [site names], stale: true when these are the saved ones because nothing could be fetched }
export async function fetchNews({ force = false, feeds = NEWS_FEEDS, now = Date.now() } = {}) {
  let saved = null;
  try { saved = JSON.parse((await readKey(KEY)) || "null"); } catch { saved = null; }
  if (!force && saved && now - saved.at < FRESH_MS) return { items: saved.items, failed: [], stale: false };

  const results = await Promise.allSettled(feeds.map(async (f) => parseFeed(await fetchText(f.url), f, now)));
  const failed = feeds.filter((_, i) => results[i].status === "rejected").map((f) => f.name);
  const lists = results.filter((r) => r.status === "fulfilled").map((r) => r.value);
  if (!lists.some((l) => l.length)) {
    // nothing came through: show what was saved, if anything
    return { items: saved?.items || [], failed: failed.length ? failed : feeds.map((f) => f.name), stale: !!saved };
  }
  const items = mergeNews(lists);
  await writeKey(KEY, JSON.stringify({ at: now, items })).catch(() => {});
  return { items, failed, stale: false };
}

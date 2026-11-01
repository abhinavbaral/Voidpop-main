// Anime, manga and novel news: turning RSS / Atom feeds into a clean list. Pure functions, no network and no
// screens (the fetching is in api/news.js, the reading is in the app's News screen).
//
// We show each site's headline, short summary and picture, then open the original article inside the app, so
// the sites keep their traffic and we never republish their articles.

const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", hellip: "…", mdash: "—", ndash: "–", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“" };

export function decodeEntities(s) {
  return String(s ?? "")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => safeChar(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => safeChar(Number(d)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m);
}
const safeChar = (n) => { try { return String.fromCodePoint(n); } catch { return ""; } };

const unCdata = (s) => String(s ?? "").replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1");

export function stripHtml(html) {
  let t = unCdata(html);
  if (!/<[a-z!/]/i.test(t) && /&lt;/i.test(t)) t = decodeEntities(t); // Atom feeds often escape their HTML (&lt;p&gt;…)
  return decodeEntities(
    t.replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
      .replace(/<\/?(?:p|br|div|li|ul|ol|h[1-6]|tr|td|blockquote|figure|img)\b[^>]*>/gi, " ") // paragraphs and the like are a space...
      .replace(/<[^>]+>/g, ""),                                                                    // ...but <b>July</b>. is still "July."
  ).replace(/\s+/g, " ").trim();
}

// cut at a word boundary, with an ellipsis
export function shorten(text, max = 220) {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), max * 0.6))}…`;
}

const first = (block, name) => {
  const m = new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)</${name}>`, "i").exec(block);
  return m ? m[1] : null;
};
const attr = (tag, name) => new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, "i").exec(tag)?.slice(2).find((x) => x != null) ?? null;

// only http(s) links; http is upgraded to https (Android blocks plain http by default)
export function cleanUrl(u) {
  const url = decodeEntities(unCdata(u)).trim();
  if (!/^https?:\/\//i.test(url)) return null;
  return url.replace(/^http:\/\//i, "https://");
}

function findImage(block, rawHtml) {
  for (const m of block.matchAll(/<media:(?:thumbnail|content)\b[^>]*>/gi)) {
    const url = cleanUrl(attr(m[0], "url") || "");
    const medium = attr(m[0], "medium"), type = attr(m[0], "type") || "";
    if (url && (!medium || medium === "image") && (!type || type.startsWith("image"))) return url;
  }
  for (const m of block.matchAll(/<enclosure\b[^>]*>/gi)) {
    const url = cleanUrl(attr(m[0], "url") || "");
    if (url && (attr(m[0], "type") || "").startsWith("image")) return url;
  }
  const img = /<img\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/i.exec(decodeEntities(rawHtml || ""));
  return img ? cleanUrl(img[1]) : null;
}

// Read one feed (RSS 2.0 or Atom). source: { id, name }. → [{ id, url, title, summary, image, source, sourceName, publishedAt, tags, kind }]
export function parseFeed(xml, source = { id: "feed", name: "News" }, now = Date.now()) {
  const text = String(xml || "").replace(/^\uFEFF/, "");
  const atom = !/<item\b/i.test(text) && /<entry\b/i.test(text);
  const blocks = text.match(atom ? /<entry\b[\s\S]*?<\/entry>/gi : /<item\b[\s\S]*?<\/item>/gi) || [];
  const out = [];
  for (const b of blocks) {
    const title = stripHtml(first(b, "title") || "");
    let link = null;
    if (atom) {
      const links = [...b.matchAll(/<link\b[^>]*>/gi)].map((m) => m[0]);
      const alt = links.find((l) => (attr(l, "rel") || "alternate") === "alternate") || links[0];
      link = alt ? cleanUrl(attr(alt, "href") || "") : null;
    } else {
      link = cleanUrl(first(b, "link") || "") || cleanUrl(first(b, "guid") || "");
    }
    if (!title || !link) continue;
    const rawBody = first(b, "content:encoded") ?? first(b, "description") ?? first(b, "summary") ?? first(b, "content") ?? "";
    const summary = shorten(stripHtml(first(b, "description") ?? first(b, "summary") ?? rawBody), 220);
    const date = Date.parse(stripHtml(first(b, "pubDate") ?? first(b, "published") ?? first(b, "updated") ?? first(b, "dc:date") ?? ""));
    const tags = [...b.matchAll(/<category\b[^>]*?(?:\/>|>([\s\S]*?)<\/category>)/gi)]
      .map((m) => stripHtml(m[1] || attr(m[0], "term") || "")).filter(Boolean);
    const item = {
      id: link, url: link, title, summary, image: findImage(b, rawBody),
      source: source.id, sourceName: source.name,
      publishedAt: Number.isFinite(date) ? Math.min(date, now) : now, // a date in the future is a feed bug: use now
      tags,
    };
    item.kind = classifyNews(item);
    out.push(item);
  }
  return out;
}

// anime | manga | novel | other, by where the words appear (title and tags count most)
const WORDS = {
  novel: /\b(light novels?|web novels?|novels?|novelists?|ln)\b/i,
  manga: /\b(manga|manhwa|manhua|webtoons?|chapters?|mangaka|shonen jump|volumes?)\b/i,
  anime: /\b(anime|episodes?|simulcast|seasons?|ova|ona|cour|trailer|key visual|voice cast|staff|crunchyroll|netflix|film|movie)\b/i,
};
export function classifyNews({ title = "", tags = [], summary = "" }) {
  // the headline decides; tags and then the summary only when the headline names no kind. If it names several
  // ("Anime based on a light novel premieres"), the one it mentions first is the story.
  for (const text of [title, tags.join(" "), summary]) {
    const hits = Object.keys(WORDS).map((k) => [k, text.search(WORDS[k])]).filter(([, at]) => at >= 0);
    if (hits.length) return hits.sort((x, y) => x[1] - y[1])[0][0];
  }
  return "other";
}

const normUrl = (u) => u.replace(/[?#].*$/, "").replace(/\/+$/, "").toLowerCase();
const normTitle = (t) => t.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

// Several feeds → one list: newest first, the same story from two sites only once.
export function mergeNews(lists, limit = 80) {
  const all = lists.flat().sort((a, b) => b.publishedAt - a.publishedAt);
  const urls = new Set();
  const titles = new Map(); // normalized title → time, to catch the same headline from two sites
  const out = [];
  for (const it of all) {
    const u = normUrl(it.url), t = normTitle(it.title);
    if (urls.has(u)) continue;
    urls.add(u); // even when the headline check below drops it: the same link is the same story
    const seenAt = titles.get(t);
    if (seenAt != null && Math.abs(seenAt - it.publishedAt) < 3 * 86400000) continue;
    titles.set(t, it.publishedAt);
    out.push(it);
    if (out.length >= limit) break;
  }
  return out;
}

export const NEWS_TABS = [
  { key: "all", label: "All" }, { key: "anime", label: "Anime" }, { key: "manga", label: "Manga" }, { key: "novel", label: "Novels" },
];
export const filterNews = (items, tab) => (tab === "all" || !tab ? items : items.filter((i) => i.kind === tab));

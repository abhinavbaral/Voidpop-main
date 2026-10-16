// Reads an animefillerlist.com show page: the episode table, one row per episode
// with its number and type (Manga Canon, Mixed Canon/Filler, Filler, Anime Canon).
// Plain text parsing, no dependencies. Written from how other open-source filler
// tools read that page; if the site's layout changes, this file is the only thing to fix.
import { parseRanges, rangesToString } from "../../shared/features/fillers.js";

const clean = (s) => s.replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();

// "Filler" → "filler", "Anime Canon" → "animeCanon", "Mixed Canon/Filler" → "mixed", "Manga Canon" → "canon"
export function typeFromText(text) {
  const t = text.toLowerCase();
  if (t.includes("mixed")) return "mixed";
  if (t.includes("anime") && t.includes("canon")) return "animeCanon";
  if (t.includes("filler")) return "filler";
  if (t.includes("canon")) return "canon";
  return null;
}

// → [{ number, type }] in page order
export function parseEpisodeTable(html) {
  const table = html.match(/<table[^>]*class="[^"]*EpisodeList[^"]*"[^>]*>([\s\S]*?)<\/table>/i);
  if (!table) return [];
  const out = [];
  for (const row of table[1].matchAll(/<tr([^>]*)>([\s\S]*?)<\/tr>/gi)) {
    const num = row[2].match(/<td[^>]*class="[^"]*Number[^"]*"[^>]*>([\s\S]*?)<\/td>/i);
    if (!num) continue; // header row
    const number = parseInt(clean(num[1]), 10);
    if (!Number.isFinite(number)) continue;
    const typeCell = row[2].match(/<td[^>]*class="[^"]*Type[^"]*"[^>]*>([\s\S]*?)<\/td>/i);
    const classes = (row[1].match(/class="([^"]*)"/i) || [, ""])[1].replace(/_/g, " ");
    const type = typeFromText(typeCell ? clean(typeCell[1]) : classes);
    if (type) out.push({ number, type });
  }
  return out;
}

// AFL's numbers → this AniList entry's numbers: number - offset, kept within 1..total.
// Returns the entry's range strings.
export function toEntry(episodes, { offset = 0, total = null } = {}) {
  const lists = { filler: [], animeCanon: [], mixed: [] };
  const counts = { canon: 0, filler: 0, animeCanon: 0, mixed: 0, dropped: 0 };
  for (const { number, type } of episodes) {
    const n = number - offset;
    if (n < 1 || (total && n > total)) { counts.dropped++; continue; }
    counts[type]++;
    if (type !== "canon") lists[type].push([n, n]);
  }
  return {
    entry: { filler: rangesToString(parseRanges(rangesToString(lists.filler))), animeCanon: rangesToString(parseRanges(rangesToString(lists.animeCanon))), mixed: rangesToString(parseRanges(rangesToString(lists.mixed))) },
    counts,
  };
}

// pages under /shows/ that are not shows (they have no episode table)
const NOT_SHOWS = new Set(["latest-updates"]);

// The site's show list page: every <a href="/shows/slug">Name</a> → [{ name, slug }], each show once.
// The slug is exactly what goes after /shows/ in the address, so it is always right.
export function parseShowList(html) {
  const seen = new Set();
  const out = [];
  for (const m of html.matchAll(/<a[^>]*href="(?:https?:\/\/[^"\/]*)?\/shows\/([^"\/?#]+)\/?"[^>]*>([\s\S]*?)<\/a>/gi)) {
    const slug = decodeURIComponent(m[1]);
    const name = clean(m[2]);
    if (!name || seen.has(slug) || NOT_SHOWS.has(slug)) continue;
    seen.add(slug);
    out.push({ name, slug });
  }
  return out;
}

// "Attack on Titan: Final Season" and "attack on titan final season" are the same title
export function normalizeTitle(t) {
  return String(t || "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").trim();
}

// From AniList search results (title.english / romaji, format, startDate) pick the one that is
// the same title as the site's name. { result, sure }: sure = the title matched exactly.
// With no exact match it returns the top search result, flagged unsure for you to check.
export function pickMatch(siteName, results) {
  const want = normalizeTitle(siteName);
  const same = results.filter((r) => [r.title?.english, r.title?.romaji].some((t) => t && normalizeTitle(t) === want));
  if (same.length) {
    const rank = (r) => (r.format === "TV" ? 0 : r.format === "TV_SHORT" ? 1 : 2);
    same.sort((a, b) => rank(a) - rank(b) || (a.startDate?.year || 9999) - (b.startDate?.year || 9999));
    return { result: same[0], sure: true };
  }
  return results.length ? { result: results[0], sure: false } : null;
}

/* ---------- seasons: follow AniList's prequel/sequel links ---------- */

// the AniList request for one entry and what it is related to
export const MEDIA_QUERY = "query($id:Int){Media(id:$id,type:ANIME){id format episodes status startDate{year month day} title{romaji english} relations{edges{relationType node{id type format episodes startDate{year month day}}}}}}";

const isSeries = (n) => !!n && n.type === "ANIME" && (n.format === "TV" || n.format === "TV_SHORT");
const startKey = (n) => (n.startDate?.year || 9999) * 10000 + (n.startDate?.month || 0) * 100 + (n.startDate?.day || 0);
const MAX_SEASONS = 15;

// All TV seasons of a franchise in order: back along PREQUEL links to the first season, then forward along
// SEQUEL links (movies, OVAs and specials are skipped because the site's page lists the TV episodes).
// getMedia(id) → the Media object from MEDIA_QUERY (it is called once per entry; the caller can cache and pause).
export async function walkSeasons(startId, getMedia) {
  const seen = new Set();
  let cur = await getMedia(startId);
  seen.add(cur.id);
  while (seen.size < MAX_SEASONS) {
    const prev = cur.relations.edges.find((e) => e.relationType === "PREQUEL" && isSeries(e.node) && !seen.has(e.node.id));
    if (!prev) break;
    cur = await getMedia(prev.node.id);
    seen.add(cur.id);
  }
  // forward pass: starts again from the first season, so the seasons we walked back through are found again
  seen.clear();
  seen.add(cur.id);
  const chain = [cur];
  while (chain.length < MAX_SEASONS) {
    const next = cur.relations.edges.filter((e) => e.relationType === "SEQUEL" && isSeries(e.node) && !seen.has(e.node.id)).map((e) => e.node).sort((a, b) => startKey(a) - startKey(b));
    if (!next.length) break;
    cur = await getMedia(next[0].id);
    seen.add(cur.id);
    chain.push(cur);
  }
  return chain;
}

// The site numbers the franchise 1..N in one run. Each season starts after the ones before it, so
// offset = episodes of the earlier seasons added up. pageLast = the site's last episode number.
// → { seasons: [{ id, name, offset, total }], ok, why }   ok = the seasons add up to the site's page.
export function planSeasons(chain, pageLast) {
  const seasons = [];
  let offset = 0;
  for (let i = 0; i < chain.length; i++) {
    const m = chain[i];
    const total = m.episodes || null;
    if (!total && i < chain.length - 1) return { seasons: [], ok: false, why: `"${m.title.english || m.title.romaji}" has no episode count on AniList, so the later seasons can't be placed` };
    seasons.push({ id: m.id, name: m.title.english || m.title.romaji, offset, total });
    offset += total || 0;
  }
  const last = seasons[seasons.length - 1];
  const ok = last.total ? pageLast === offset : pageLast > last.offset; // an ongoing last season has no total yet
  return { seasons, ok, why: ok ? null : `the site's episodes run to ${pageLast}, but the ${seasons.length} season${seasons.length === 1 ? "" : "s"} on AniList add up to ${offset}${last.total ? "" : " so far"}` };
}

// The list file: one show per line, "anilistId afl-page-name [offset [total]]", # starts a comment.
// → { jobs, problems }. A line that doesn't fit is reported with its line number and skipped, instead of
// being sent to AniList (a line like "CHECK 1535 death-note", where only the # was removed, used to end up there).
export function parseJobList(text) {
  const jobs = [];
  const problems = [];
  text.split(/\r?\n/).forEach((raw, i) => {
    const line = raw.replace(/#.*/, "").trim();
    if (!line) return;
    const [id, afl, offset, total, ...extra] = line.split(/\s+/);
    const digits = (v) => v === undefined || /^\d+$/.test(v);
    if (!/^\d+$/.test(id) || !afl || /^\d+$/.test(afl) || !digits(offset) || !digits(total) || extra.length) {
      problems.push(`line ${i + 1}: "${line}" is not "anilistId page-name [offset [total]]". Did you leave CHECK in front of it?`);
      return;
    }
    jobs.push({ id, afl, offset, total });
  });
  return { jobs, problems };
}

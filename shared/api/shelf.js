// FILE: shared/api/shelf.js — games and comics for Explore, Search and the title pages. Today every answer comes from the
// sample catalogue (shared/demo/shelf.js). When the VoidPop server exists, call configureShelf({ baseUrl }) once at start:
// requests then go to  GET {baseUrl}/shelf/{game|comic}?sort=popular|trending|coming|new&q=text  answering { items: [...] }
// and  GET {baseUrl}/shelf/{game|comic}/{id}  answering one item, in the same item shape as the sample catalogue. If the
// server can't be reached the sample catalogue answers, so these functions never reject. (Server contract: not built yet.)
// Real sources are IGDB for games and a comics database for comics; both need keys, so they belong on the server, not in the app.

import { DEMO_GAMES, DEMO_COMICS } from "../demo/shelf.js";

let base = null;
export const configureShelf = ({ baseUrl } = {}) => { base = baseUrl ? String(baseUrl).replace(/\/$/, "") : null; };
export const hasShelfServer = () => !!base;

async function remote(path) {
  if (!base) return null;
  try {
    const res = await fetch(`${base}/shelf/${path}`, { headers: { Accept: "application/json" } });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

const catalogue = (segment) => (segment === "game" ? DEMO_GAMES() : DEMO_COMICS());

const SORTS = {
  popular: (a, b) => (b.popularity || 0) - (a.popularity || 0),
  new: (a, b) => (b.date || "").localeCompare(a.date || ""),
  coming: (a, b) => (a.date || "").localeCompare(b.date || ""),
};

// segment: "game" | "comic". sort: popular | new | coming (not out yet, soonest first; comics: next issue soonest first)
// -> { items }
export async function fetchShelf(segment, { sort = "popular", query = "" } = {}) {
  const r = await remote(`${segment}?sort=${encodeURIComponent(sort)}&q=${encodeURIComponent(query)}`);
  if (Array.isArray(r?.items)) return { items: r.items };
  let items = catalogue(segment);
  const q = query.trim().toLowerCase();
  if (q) items = items.filter((it) => [it.title, it.developer, it.publisher, it.writer, ...(it.genres || [])].filter(Boolean).some((t) => t.toLowerCase().includes(q)));
  if (sort === "coming") {
    items = items.filter((it) => (segment === "game" ? it.unreleased : !!it.nextIssue))
      .sort((a, b) => (segment === "game" ? a.releaseAt - b.releaseAt : a.nextIssue.airingAt - b.nextIssue.airingAt));
  } else {
    items = items.sort(SORTS[sort] || SORTS.popular);
  }
  return { items };
}

export async function fetchShelfItem(segment, id) {
  const r = await remote(`${segment}/${encodeURIComponent(id)}`);
  if (r && r.id != null) return r;
  return catalogue(segment).find((it) => String(it.id) === String(id)) || null;
}

// Search both kinds at once (Search screen). -> items
export async function searchShelf(query) {
  const q = String(query || "").trim();
  if (!q) return [];
  const [g, c] = await Promise.all([fetchShelf("game", { query: q }), fetchShelf("comic", { query: q })]);
  return [...g.items, ...c.items];
}

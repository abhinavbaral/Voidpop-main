// Library as playlists (like Spotify's Your Library). Each status is a playlist of
// your titles (Watching, Completed, Plan to Watch…), made by VoidPop, and the lists
// you make yourself (categories) are playlists too. Plain functions: the Library
// screen shows what buildPlaylists() returns.

export const PLAYLIST_SORTS = [
  { key: "recents", label: "Recents" },
  { key: "alpha", label: "A–Z" },
  { key: "size", label: "Most titles" },
];

const keyOf = (e) => `${e.item.segment}:${e.item.id}`;

// statuses: [{ key, label }] for this kind (statusesFor), cats: [{ id, name }], entries: library entries of ONE kind.
// → [{ id, type: "status" | "custom", ref (status key or category id), name, owner, count, covers (up to 4 cover urls), touched }]
// Playlists are never left out: an empty one still shows (with no covers).
export function buildPlaylists(entries, statuses, cats, sort = "recents") {
  const cover = (e) => e.item.imageSmall || e.item.image;
  const recent = (a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || "");
  const make = (id, type, ref, name, owner, list) => {
    const sorted = [...list].sort(recent);
    return {
      id, type, ref, name, owner, count: list.length,
      covers: sorted.map(cover).filter(Boolean).slice(0, 4),
      touched: sorted[0]?.updatedAt || "",
    };
  };
  const out = [
    ...statuses.map((s) => make(`status:${s.key}`, "status", s.key, s.label, "VoidPop", entries.filter((e) => e.status === s.key))),
    ...cats.map((c) => make(`custom:${c.id}`, "custom", c.id, c.name, "You", entries.filter((e) => (e.cats || []).includes(c.id)))),
  ];
  const by = {
    recents: (a, b) => (!a.count) - (!b.count) || b.touched.localeCompare(a.touched), // empty ones sink
    alpha: (a, b) => a.name.localeCompare(b.name),
    size: (a, b) => b.count - a.count || a.name.localeCompare(b.name),
  }[sort] || (() => 0);
  return out.sort(by);
}

// The titles in one playlist (of one kind)
export const playlistEntries = (entries, type, ref) =>
  entries.filter((e) => (type === "custom" ? (e.cats || []).includes(ref) : e.status === ref));

// How many of the titles in a list match a search, for the "N found" line
export function searchEntries(entries, query) {
  const q = query.trim().toLowerCase();
  return q ? entries.filter((e) => e.item.title.toLowerCase().includes(q)) : [];
}

export { keyOf as playlistKeyOf };

// Library as playlists (like Spotify's Your Library). Each status is a playlist of
// your titles (Watching, Completed, Plan to Watch…), made by VoidPop. A status with no
// titles in it is not shown. Plain functions: the Library screen shows what
// buildPlaylists() returns.

export const PLAYLIST_SORTS = [
  { key: "recents", label: "Recents" },
  { key: "alpha", label: "A–Z" },
  { key: "size", label: "Most titles" },
];

const keyOf = (e) => `${e.item.segment}:${e.item.id}`;

// statuses: [{ key, label }] for this kind (statusesFor); entries: library entries of ONE kind.
// → [{ id, ref (the status key), name, owner, count, cover (ONE cover url, or null), touched }]
export function buildPlaylists(entries, statuses, sort = "recents") {
  const cover = (e) => e.item.imageSmall || e.item.image;
  const recent = (a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || "");
  const out = statuses
    .map((s) => {
      const sorted = entries.filter((e) => e.status === s.key).sort(recent);
      return {
        id: `status:${s.key}`, ref: s.key, name: s.label, owner: "VoidPop", count: sorted.length,
        cover: sorted.map(cover).find(Boolean) || null, // one show: the one you touched last
        touched: sorted[0]?.updatedAt || "",
      };
    })
    .filter((p) => p.count > 0); // a status with no titles isn't shown
  const by = {
    recents: (a, b) => b.touched.localeCompare(a.touched),
    alpha: (a, b) => a.name.localeCompare(b.name),
    size: (a, b) => b.count - a.count || a.name.localeCompare(b.name),
  }[sort] || (() => 0);
  return out.sort(by);
}

// The titles in one playlist (of one kind)
export const playlistEntries = (entries, ref) => entries.filter((e) => e.status === ref);

// How many of the titles in a list match a search, for the "N found" line
export function searchEntries(entries, query) {
  const q = query.trim().toLowerCase();
  return q ? entries.filter((e) => e.item.title.toLowerCase().includes(q)) : [];
}

export { keyOf as playlistKeyOf };

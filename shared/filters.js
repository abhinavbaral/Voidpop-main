// Genre and studio filters for lists that are already loaded (Season chart,
// Schedule's week). Options come from the titles themselves, most common
// first, so you never pick a genre that shows nothing.

function countBy(items, pick) {
  const counts = new Map();
  items.forEach((it) => pick(it).forEach((v) => v && counts.set(v, (counts.get(v) || 0) + 1)));
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([v, n]) => ({ key: v, label: v, count: n }));
}

export function filterOptions(items) {
  return {
    genres: countBy(items, (it) => it.genres || []),
    studios: countBy(items, (it) => (it.segment === "anime" && it.creator ? [it.creator] : [])),
  };
}

export function applyFilters(items, { genre = "", studio = "" } = {}) {
  return items.filter((it) => (!genre || (it.genres || []).includes(genre)) && (!studio || it.creator === studio));
}

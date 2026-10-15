// What the home-screen widget shows: the next episode of up to 30 anime you
// follow (Watching, Plan to Watch, On Hold, Excited), soonest first.
// Fresh times from AniList when online; the offline copy / saved library
// snapshots otherwise, so the widget still works without internet.
import { fetchNextEpisodes } from "@voidpop/shared/api/anilist";
import { getLibrary, getExcited } from "@voidpop/shared/backend/store";

export const WIDGET_LIMIT = 30;
const FOLLOWING = new Set(["watching", "plan", "onhold"]);

// quick: saved data only (no network), so the widget can draw immediately
export async function loadWidgetRows({ quick = false } = {}) {
  const [lib, excited] = await Promise.all([getLibrary(), getExcited()]);
  const saved = {};
  Object.values(lib).forEach((e) => {
    if (e.item.segment === "anime" && FOLLOWING.has(e.status)) saved[e.item.id] = { ...e.item, delay: e.delay };
  });
  Object.values(excited).forEach((e) => {
    if (e.item.segment === "anime" && !saved[e.item.id]) saved[e.item.id] = e.item;
  });
  const ids = Object.keys(saved);
  let fresh = {};
  if (!quick) {
    try { fresh = await fetchNextEpisodes(ids); } catch { /* offline, nothing cached: use snapshots */ }
  }
  const now = Date.now() / 1000;
  return ids
    .map((id) => {
      const it = fresh[id] || saved[id];
      return { id, title: it.title, image: it.image, next: it.nextEpisode, delayed: !!saved[id].delay };
    })
    .filter((r) => r.next && r.next.airingAt > now - 3600)
    .sort((a, b) => a.next.airingAt - b.next.airingAt)
    .slice(0, WIDGET_LIMIT);
}

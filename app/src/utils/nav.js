// Navigation helpers shared by every screen.
//
// Detail pages are addressed by (segment, id) so they have real URLs on web
// (/title/anime/16498) that survive refresh and can be shared. When we already
// have the item in hand (tapping a card), we stash it in a small in-memory
// cache so the page renders instantly instead of re-fetching.

const itemCache = new Map();
const key = (segment, id) => `${segment}:${id}`;

export function cacheItem(item) {
  if (item?.segment && item?.id != null) itemCache.set(key(item.segment, item.id), item);
}

export function getCachedItem(segment, id) {
  return itemCache.get(key(segment, id)) || null;
}

export function openDetail(navigation, item, { push = false } = {}) {
  cacheItem(item);
  const params = { segment: item.segment, id: String(item.id) };
  if (push) navigation.push("Detail", params);
  else navigation.navigate("Detail", params);
}

// On web a user can land directly on /search or /title/... with no history,
// where goBack() would throw "GO_BACK was not handled". Fall back to Home.
export function goBackOrHome(navigation, fallback = { name: "Main" }) {
  if (navigation.canGoBack()) navigation.goBack();
  else navigation.navigate(fallback.name, fallback.params);
}

export const toProfile = (navigation) =>
  navigation.navigate("Main", { screen: "More" });

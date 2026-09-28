// Title URLs + a small in-memory cache so a page opened from a card renders
// instantly, while a direct visit or refresh fetches by id.
import { fetchAniListItem } from "@voidation/shared/api/anilist";

export const SEGMENTS = ["anime", "manga"];
export const SEGMENT_LABEL = { anime: "Anime", manga: "Manga" };
export const CREATOR_LABEL = { manga: "Mangaka", anime: "Studio" };

export const titlePath = (item) => `/title/${item.segment}/${item.id}`;

const cache = new Map();
const key = (segment, id) => `${segment}:${id}`;
export const cacheTitle = (item) => item && cache.set(key(item.segment, item.id), item);
export const cachedTitle = (segment, id) => cache.get(key(segment, id)) || null;

export async function loadTitle(segment, id) {
  const hit = cachedTitle(segment, id);
  if (hit) return hit;
  const item = await fetchAniListItem(segment, id);
  if (item) cacheTitle(item);
  return item;
}

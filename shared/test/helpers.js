// Test helpers: an in-memory storage adapter and a fake AniList server.
import { setStorage } from "../backend/storage.js";

// Plug an in-memory storage in before the store is imported. `seed` = initial keys.
export function memoryStorage(seed = {}) {
  const mem = { ...seed };
  setStorage({
    getItem: async (k) => mem[k] ?? null,
    setItem: async (k, v) => { mem[k] = v; },
    removeItem: async (k) => { delete mem[k]; },
  });
  return mem;
}

// Replace fetch with a handler: (query, variables) → data. Returns the call log.
export function fakeAniList(handler) {
  const calls = [];
  globalThis.fetch = async (_url, opts) => {
    const { query, variables } = JSON.parse(opts.body);
    calls.push({ query, variables });
    const data = await handler(query, variables || {});
    return { ok: true, status: 200, headers: { get: () => null }, json: async () => ({ data }) };
  };
  return calls;
}

export const daysAgo = (n, now = Date.now()) => new Date(now - n * 864e5).toISOString();

// A minimal AniList Media object as the API returns it
export const media = (id, extra = {}) => ({
  id, title: { english: `Title ${id}`, romaji: `Romaji ${id}` }, coverImage: { large: "x.jpg", color: "#e4a15d" },
  startDate: { year: 2024, month: 1, day: 5 }, genres: ["Action"], status: "FINISHED", format: "TV",
  episodes: 12, chapters: null, siteUrl: `https://anilist.co/anime/${id}`, ...extra,
});

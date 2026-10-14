import { test } from "node:test";
import assert from "node:assert/strict";
import { memoryStorage, fakeAniList, media } from "./helpers.js";

memoryStorage();
const a = await import("../api/anilist.js");
const { readingLinks } = await import("../features/readLinks.js");

test("normalize: title, colour, hype fields come through", async () => {
  fakeAniList(() => ({ Media: media(5, { popularity: 12400, trending: 30 }) }));
  const it = await a.fetchAniListItem("anime", 5);
  assert.equal(it.title, "Title 5");
  assert.equal(it.altTitle, "Romaji 5");
  assert.equal(it.color, "#e4a15d");
  assert.equal(it.popularity, 12400);
  assert.equal(it.date, "2024-01-05");
});

test("cover pool: trending covers, entries without a cover skipped, trimmed to the count", async () => {
  fakeAniList(() => ({ Page: { media: [
    { id: 1, coverImage: { extraLarge: "u1", color: "#fff" } },
    { id: 2, coverImage: { extraLarge: null } },
    { id: 3, coverImage: { extraLarge: "u3", color: null } },
    { id: 4, coverImage: { extraLarge: "u4", color: null } },
  ] } }));
  const pool = await a.fetchCoverPool(2);
  assert.deepEqual(pool, [{ id: 1, uri: "u1", color: "#fff" }, { id: 3, uri: "u3", color: null }]);
});

test("source line: comics before novels, labels by country and format", () => {
  const edge = (id, format, country) => ({ relationType: "SOURCE", node: { ...media(id), type: "MANGA", format, countryOfOrigin: country } });
  const s = a.sourceInfo("WEB_NOVEL", [edge(1, "NOVEL", "KR"), edge(2, "MANGA", "KR"), { relationType: "SEQUEL", node: { type: "ANIME" } }]);
  assert.deepEqual(s.items.map((i) => [i.kindLabel, i.novel]), [["Manhwa", false], ["Web novel", true]]);
  assert.equal(a.sourceInfo("ORIGINAL", []).label, "Original");
  assert.equal(a.sourceKindLabel({ format: "NOVEL", countryOfOrigin: "JP" }), "Light novel");
  assert.equal(a.sourceInfo(null, []), null);
});

test("episode list: numbered, de-duplicated, sorted", () => {
  const eps = a.episodeList([
    { title: "Episode 2 - The Duel", url: "u2", site: "Crunchyroll" },
    { title: "Episode 1 - Start", url: "u1" }, { title: "Episode 1 - Start", url: "u1" }, { title: "Special", url: "u3" },
  ]);
  assert.deepEqual(eps.map((e) => [e.number, e.name]), [[1, "Start"], [2, "The Duel"], [null, "Special"]]);
});

test("where to watch merges languages per service", () => {
  const w = a.watchLinks([
    { site: "Crunchyroll", url: "c", type: "STREAMING", language: "English" },
    { site: "Crunchyroll", url: "c", type: "STREAMING", language: "Hindi" },
    { site: "Twitter", url: "t", type: "SOCIAL" },
  ]);
  assert.deepEqual(w.map((x) => [x.site, x.languages]), [["Crunchyroll", ["English", "Hindi"]]]);
});

test("other links: official, social, AniList and MAL pages; streaming and readers left out", () => {
  const l = a.otherLinks([
    { site: "Official Site", url: "https://show.jp", type: "INFO", language: "Japanese" },
    { site: "Official Site", url: "https://show.jp", type: "INFO", language: "Japanese" },
    { site: "Twitter", url: "https://x.com/show", type: "SOCIAL" },
    { site: "YouTube", url: "https://youtube.com/x", type: "SOCIAL", isDisabled: true },
    { site: "Bad", url: "javascript:alert(1)", type: "SOCIAL" },
    { site: "Crunchyroll", url: "https://cr.com", type: "STREAMING" },
    { site: "MANGA Plus", url: "https://mangaplus", type: "INFO" },
    null,
  ], { segment: "manga", idMal: 13, siteUrl: "https://anilist.co/manga/30013", exclude: ["https://mangaplus"] });
  assert.deepEqual(l.official.map((x) => x.site), ["Official Site"]);
  assert.deepEqual(l.social.map((x) => x.site), ["Twitter"]);
  assert.deepEqual(l.databases.map((x) => x.url), ["https://anilist.co/manga/30013", "https://myanimelist.net/manga/13"]);
  assert.deepEqual(a.otherLinks(undefined), { official: [], social: [], databases: [] });
});

test("where to read: readers (even filed as INFO), stores, search fallback", () => {
  const r = readingLinks([
    { site: "MANGA Plus", url: "m", type: "INFO", language: "English" },
    { site: "Kodansha USA", url: "k", type: "INFO" },
    { site: "Amazon", url: "a", type: "INFO" },
  ], { title: "One Piece", country: "JP" });
  assert.deepEqual(r.read.map((x) => x.site), ["MANGA Plus"]);
  assert.deepEqual(r.buy.map((x) => x.site), ["Amazon"]);
  assert.equal(r.search.length, 0);
  const none = readingLinks([], { title: "Solo Leveling", country: "KR" });
  assert.equal(none.search[0].site, "WEBTOON");
  assert.match(none.search[0].url, /keyword=Solo%20Leveling/);
});

test("MAL ids are looked up 50 at a time", async () => {
  const calls = fakeAniList((q, v) => ({ Page: { media: v.ids.map((id) => ({ ...media(id + 1000), idMal: id })) } }));
  const ids = Array.from({ length: 120 }, (_, i) => i + 1);
  const found = await a.fetchByMalIds("anime", ids);
  assert.equal(Object.keys(found).length, 120);
  assert.equal(found[7].id, 1007);
  assert.equal(calls.length, 3);
});

test("watch order follows prequel/sequel links and sorts by date", async () => {
  const graph = {
    1: media(1, { startDate: { year: 2020 }, relations: { edges: [{ relationType: "SEQUEL", node: { id: 2, type: "ANIME", format: "TV" } }] } }),
    2: media(2, { startDate: { year: 2022 }, relations: { edges: [{ relationType: "PREQUEL", node: { id: 1, type: "ANIME", format: "TV" } }, { relationType: "SIDE_STORY", node: { id: 3, type: "ANIME", format: "MOVIE" } }, { relationType: "ALTERNATIVE", node: { id: 9, type: "ANIME" } }] } }),
    3: media(3, { startDate: { year: 2021 }, format: "MOVIE", relations: { edges: [] } }),
  };
  fakeAniList((q, v) => ({ Page: { media: v.ids.map((id) => graph[id]).filter(Boolean) } }));
  const order = await a.fetchWatchOrder(2);
  assert.deepEqual(order.map((x) => x.id), [1, 3, 2]); // alternative (remake) left out
});

test("watch order labels: seasons, movies and specials counted in order", () => {
  const out = a.labelOrder([{ format: "TV" }, { format: "OVA" }, { format: "TV" }, { format: "MOVIE" }, { format: "SPECIAL" }, { format: "ONA" }, { format: "MOVIE" }]);
  assert.deepEqual(out.map((x) => x.orderLabel), ["Season 1", "OVA", "Season 2", "Movie 1", "Special", "Season 3", "Movie 2"]);
});

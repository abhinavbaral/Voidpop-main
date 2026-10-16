// The filler builder: reads an animefillerlist.com page and turns it into a database entry.
// (A saved sample page is used, so the tests need no internet. The real site has not been
// tested here: run the builder on one show and compare with the page.)
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { parseEpisodeTable, toEntry, typeFromText, parseShowList, normalizeTitle, pickMatch, walkSeasons, planSeasons, parseJobList } from "../../tools/lib/afl.mjs";
import { checkFillerDb } from "../features/fillers.js";

const html = await readFile(new URL("./fixtures/afl-sample.html", import.meta.url), "utf8");

test("the four episode types are recognised", () => {
  assert.equal(typeFromText("Manga Canon"), "canon");
  assert.equal(typeFromText("Filler"), "filler");
  assert.equal(typeFromText("Anime Canon"), "animeCanon");
  assert.equal(typeFromText("Mixed Canon/Filler"), "mixed");
  assert.equal(typeFromText("???"), null);
});

test("the episode table is read, header row and quick lists ignored", () => {
  const eps = parseEpisodeTable(html);
  assert.equal(eps.length, 30);
  assert.deepEqual(eps.find((e) => e.number === 6), { number: 6, type: "filler" });
  assert.deepEqual(eps.find((e) => e.number === 12), { number: 12, type: "animeCanon" });
  assert.deepEqual(eps.find((e) => e.number === 15), { number: 15, type: "mixed" });
  assert.deepEqual(parseEpisodeTable("<html>no table</html>"), []);
});

test("a whole page becomes ranges", () => {
  const { entry, counts } = toEntry(parseEpisodeTable(html));
  assert.deepEqual(entry, { filler: "5-8", animeCanon: "12-13", mixed: "15" });
  assert.deepEqual([counts.filler, counts.animeCanon, counts.mixed, counts.canon], [4, 2, 1, 23]);
});

test("a later season: site numbers minus the offset, kept inside the entry", () => {
  // the page's episodes 11-30 are this AniList entry's 1-20: offset 10, 20 episodes
  const { entry, counts } = toEntry(parseEpisodeTable(html), { offset: 10, total: 20 });
  assert.deepEqual(entry, { filler: "", animeCanon: "2-3", mixed: "5" });
  assert.equal(counts.dropped, 10);
  assert.deepEqual(checkFillerDb({ 1: entry }), []);
});

test("the show list: names and page names, each show once", async () => {
  const list = parseShowList(await readFile(new URL("./fixtures/afl-show-list.html", import.meta.url), "utf8"));
  assert.deepEqual(list.map((x) => x.slug), ["naruto", "attack-on-titan", "one-piece", "d-gray-man"]);
  assert.equal(list[3].name, "D.Gray-man & friends");
});

test("titles are compared without case, accents or punctuation", () => {
  assert.equal(normalizeTitle("Fullmetal Alchemist: Brotherhood"), normalizeTitle("fullmetal alchemist brotherhood"));
  assert.equal(normalizeTitle("Pokémon"), normalizeTitle("Pokemon"));
  assert.equal(normalizeTitle("Tom & Jerry"), normalizeTitle("Tom and Jerry"));
});

test("matching AniList results to a site title: exact is sure, anything else is flagged", () => {
  const r = (id, english, romaji, format, year) => ({ id, title: { english, romaji }, format, startDate: { year } });
  const results = [r(2, "Naruto: Shippuden", "Naruto: Shippuuden", "TV", 2007), r(3, null, "Naruto", "MOVIE", 2004), r(1, "Naruto", "Naruto", "TV", 2002)];
  assert.deepEqual([pickMatch("Naruto", results).result.id, pickMatch("Naruto", results).sure], [1, true]); // the TV series, not the movie
  const vague = pickMatch("Death Note", [r(9, "Death Note: Rewrite", "Death Note: Rewrite", "MOVIE", 2007)]);
  assert.deepEqual([vague.result.id, vague.sure], [9, false]);
  assert.equal(pickMatch("Nothing", []), null);
});

// a made-up franchise: season 1 (25 eps) → season 2 (12) → season 3 (22); a movie and a side story hang off it
const edge = (relationType, id, format = "TV") => ({ relationType, node: { id, type: "ANIME", format, episodes: null, startDate: { year: 2000 + id } } });
const media = (id, episodes, edges) => ({ id, episodes, format: "TV", title: { english: `Season ${id}`, romaji: null }, relations: { edges } });
const graph = {
  1: media(1, 25, [edge("SEQUEL", 2), edge("SEQUEL", 90, "MOVIE")]),
  2: media(2, 12, [edge("PREQUEL", 1), edge("SEQUEL", 3), edge("SIDE_STORY", 91)]),
  3: media(3, 22, [edge("PREQUEL", 2)]),
};

test("seasons are found by following sequel links, from any season, skipping movies", async () => {
  for (const start of [1, 2, 3]) {
    const chain = await walkSeasons(start, async (id) => graph[id]);
    assert.deepEqual(chain.map((m) => m.id), [1, 2, 3]);
  }
  // two entries that point at each other don't loop forever
  const loop = { 1: media(1, 10, [edge("SEQUEL", 2)]), 2: media(2, 10, [edge("SEQUEL", 1), edge("PREQUEL", 1)]) };
  assert.equal((await walkSeasons(1, async (id) => loop[id])).length, 2);
});

test("each season's offset is the episodes before it; it must add up to the site's page", async () => {
  const chain = await walkSeasons(1, async (id) => graph[id]);
  const ok = planSeasons(chain, 59);
  assert.equal(ok.ok, true);
  assert.deepEqual(ok.seasons.map((s) => [s.id, s.offset, s.total]), [[1, 0, 25], [2, 25, 12], [3, 37, 22]]);
  const off = planSeasons(chain, 61);
  assert.equal(off.ok, false);
  assert.match(off.why, /run to 61.*add up to 59/);
});

test("an ongoing last season, and a middle season with no episode count", () => {
  const ongoing = [media(1, 12, []), media(2, null, [])];
  assert.equal(planSeasons(ongoing, 20).ok, true); // the site is past season 1's end
  assert.equal(planSeasons(ongoing, 12).ok, false); // nothing of season 2 on the site yet
  const hole = [media(1, null, []), media(2, 12, [])];
  assert.equal(planSeasons(hole, 24).ok, false);
});

test("the show list leaves out pages that are not shows", () => {
  const html = '<a href="/shows/latest-updates">Latest Updates</a><a href="/shows/naruto">Naruto</a>';
  assert.deepEqual(parseShowList(html).map((x) => x.slug), ["naruto"]);
});

test("the list file: good lines become jobs, bad ones are reported with their line number", () => {
  const { jobs, problems } = parseJobList([
    "# comment", "", "20 naruto   # Naruto", "1735 naruto-shippuden 0 500",
    "CHECK 1535 death-note", "abc some-show", "21 one-piece extra words here", "# CHECK 5 skipped-by-hash",
  ].join("\n"));
  assert.deepEqual(jobs, [{ id: "20", afl: "naruto", offset: undefined, total: undefined }, { id: "1735", afl: "naruto-shippuden", offset: "0", total: "500" }]);
  assert.deepEqual(problems.map((p) => p.slice(0, 7)), ["line 5:", "line 6:", "line 7:"]);
});

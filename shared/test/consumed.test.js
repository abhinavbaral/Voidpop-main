// Ranks count Content consumed: everything finished, whatever the kind. Plus the Consumer and Cinema Lover badges.
import { test } from "node:test";
import assert from "node:assert/strict";
import { memoryStorage } from "./helpers.js";

memoryStorage();
const s = await import("../backend/store.js");
const { computeAchievements } = await import("../features/achievements.js");

const anime = (id) => ({ id, segment: "anime", title: `A${id}`, episodes: 12, finished: true });
const manga = (id) => ({ id, segment: "manga", format: "MANGA", title: `M${id}`, chapters: 10, finished: true });
const novel = (id) => ({ id, segment: "manga", format: "NOVEL", title: `N${id}`, chapters: 10, finished: true });
const film = (id) => ({ id, segment: "movie", title: `F${id}`, genres: [] });
const serial = (id) => ({ id, segment: "tv", title: `S${id}`, genres: [] });
const badge = async (key) => (await computeAchievements()).find((x) => x.key === key);

test("a fresh phone: no rank yet, nothing consumed, no Consumer badge, no rank collected", async () => {
  const st = await s.getStats();
  assert.deepEqual([st.totalCompleted, st.anime, st.manga, st.novel, st.movie, st.tv], [0, 0, 0, 0, 0, 0]);
  assert.equal((await s.getUserTier()).tier.key, "unranked");
  assert.equal(await s.checkRankUp(), null);            // nothing to celebrate
  assert.equal(await s.getRanksCollected(), 0);
  assert.equal((await badge("rankCollector")).level, 0);
  assert.equal((await badge("consumer")).earned, false);
});

test("the first finished title of any kind, even a movie, makes you a Newbie; Consumer needs 5", async () => {
  await s.setCinemaStatus(film(1), "completed");
  assert.equal((await s.getUserTier()).tier.key, "newbie");
  assert.equal((await s.checkRankUp()).key, "newbie");  // the first rank is celebrated now
  assert.equal(await s.getRanksCollected(), 1);
  const c = await badge("consumer");
  assert.deepEqual([c.name, c.have, c.need, c.earned, c.text], ["Consumer", 1, 5, false, "Finish 5 anime, manga, novels, movies or TV shows"]);
});

test("anime, manga, novels, movies and TV all count, each once; only finished ones", async () => {
  await s.setStatus(null, "anime", anime(1), "completed");
  await s.setStatus(null, "manga", manga(1), "completed");
  await s.setStatus(null, "manga", novel(2), "completed"); // a different id: novels share the manga key space
  await s.setCinemaStatus(serial(1), "completed");
  await s.setCinemaStatus(serial(2), "rewatching");     // a show you finished and are watching again still counts
  await s.setCinemaStatus(film(2), "plan");             // not finished: not counted
  await s.setCinemaStatus(film(3), "considering");      // not finished: not counted
  await s.setStatus(null, "anime", anime(2), "watching");
  const st = await s.getStats();
  assert.deepEqual([st.anime, st.manga, st.novel, st.movie, st.tv], [1, 1, 1, 1, 2]); // the movie from before + the TV
  assert.equal(st.totalCompleted, 6);
  assert.equal((await s.getUserTier()).tier.key, "rookie"); // 6 is Rookie (5+): movies and TV moved the rank
  assert.equal((await badge("consumer")).done, true);         // and 5+ titles of mixed kinds earn Consumer
});

test("removing a movie lowers the count again", async () => {
  await s.setCinemaStatus(film(1), null);
  assert.equal((await s.getStats()).totalCompleted, 5);
});

test("rank wording says content consumed, never 'anime completed + manga finished'", () => {
  for (const t of s.TIERS) assert.doesNotMatch(t.message, /anime completed|manga finished/i, t.key);
  assert.match(s.TIERS[1].message, /^5 titles consumed/);
  assert.match(s.TIERS[0].message, /movies and TV/);
});

test("Cinema Lover: five levels of movies or TV shows watched, 5 / 25 / 125 / 625 / 3125, in any mix", async () => {
  let b = await badge("cinemaLover");
  assert.deepEqual([b.name, b.icon, b.levels, b.maxLevel], ["Cinema Lover", "film", [5, 25, 125, 625, 3125], 5]);
  // so far 2 TV shows are done/rewatching + 0 movies: below level 1
  assert.deepEqual([b.level, b.have, b.need, b.earned], [0, 2, 5, false]);
  assert.equal(b.text, "Watch 5 movies or TV shows");

  await s.setCinemaStatus(film(10), "completed");
  await s.setCinemaStatus(film(11), "completed");
  await s.setCinemaStatus(serial(10), "completed");     // 2 TV + 3 movies = 5, mixed
  b = await badge("cinemaLover");
  assert.deepEqual([b.level, b.earned, b.need, b.done], [1, true, 25, false]);
  assert.equal(b.text, "Watch 25 movies or TV shows");

  for (let i = 100; i < 120; i++) await s.setCinemaStatus(i % 2 ? film(i) : serial(i), "completed"); // +20 = 25
  b = await badge("cinemaLover");
  assert.deepEqual([b.level, b.need], [2, 125]);

  for (let i = 200; i < 300; i++) await s.setCinemaStatus(film(i), "completed"); // +100 = 125
  b = await badge("cinemaLover");
  assert.deepEqual([b.level, b.need, b.text], [3, 625, "Watch 625 movies or TV shows"]);
});

test("Cinema Lover's last goal is worded with a thousands separator, and tops out at level 5", async () => {
  for (let i = 300; i < 300 + 3100; i++) await s.setCinemaStatus(film(i), "completed"); // well past 3,125 in total
  const b = await badge("cinemaLover");
  assert.deepEqual([b.level, b.done, b.have, b.need], [5, true, 3125, 3125]);
  assert.equal(b.text, "Watch 3,125 movies or TV shows");
});

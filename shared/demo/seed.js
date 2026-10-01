// DEMO MODE seed: a lived-in library for the demo, in the exact shape
// shared/backend/store.js reads and writes (see demo/storage.js).
import { CATALOG, findItem, toAppItem } from "./catalog.js";

const ago = (hours) => new Date(Date.now() - hours * 3600e3).toISOString();

// [segment, title, status]
const MY_LIBRARY = [
  ...["Attack on Titan", "Attack on Titan Season 2", "Fullmetal Alchemist: Brotherhood", "Death Note",
      "Steins;Gate", "Mob Psycho 100", "Cowboy Bebop", "Violet Evergarden", "Demon Slayer"]
    .map((t) => ["anime", t, "completed"]),
  // currently airing → these drive "Your next episodes" on the Schedule page
  ["anime", "Frieren: Beyond Journey's End", "watching"], ["anime", "Solo Leveling", "watching"],
  ["anime", "Jujutsu Kaisen", "watching"], ["anime", "Spy x Family", "plan"],
  ["anime", "Vinland Saga", "plan"], ["anime", "Link Click", "onhold"],
  ["manga", "One Piece", "watching"], ["manga", "Berserk", "completed"], ["manga", "Solo Leveling", "completed"],
  ["manga", "Vagabond", "plan"], ["manga", "Tower of God", "dropped"], ["manga", "Watchmen", "completed"],
];

// progress for the demo: some caught up, some behind (History / Library show it)
const PROGRESS = {
  "anime:Frieren: Beyond Journey's End": 6, "anime:Solo Leveling": 6, "anime:Jujutsu Kaisen": 14,
  "anime:Link Click": 3, "manga:One Piece": 1098, "manga:Tower of God": 212,
};

// [segment, title, verdict, vibes, comment]
const MY_REVIEWS = [
  ["anime", "Attack on Titan", "peak", ["Action", "Mystery", "Emotional"], "Every season raises the stakes. Watched the finale at 3am, no regrets."],
  ["anime", "Death Note", "divein", ["Thriller", "Mystery"], "Light vs L is still the best cat-and-mouse in anime."],
  ["manga", "Berserk", "peak", ["Dark", "Action"], "The art alone is worth it."],
];

export function seedDemoDb() {
  const db = { library: {}, reviews: {}, excited: {} };
  MY_LIBRARY.forEach(([segment, title, status], i) => {
    const it = CATALOG[segment].find((x) => x.title === title);
    if (it) {
      db.library[`${segment}:${it.id}`] = {
        status, progress: PROGRESS[`${segment}:${title}`] || 0, item: toAppItem(it), updatedAt: ago(10 + i * 17),
      };
    }
  });
  // Solo Leveling's episode was saved as airing two hours earlier than it now does,
  // so the demo shows a "Delayed" label as soon as the Schedule loads.
  const solo = Object.values(db.library).find((e) => e.item.title === "Solo Leveling" && e.item.segment === "anime");
  if (solo?.item.nextEpisode) solo.item = { ...solo.item, nextEpisode: { ...solo.item.nextEpisode, airingAt: solo.item.nextEpisode.airingAt - 2 * 3600 } };
  MY_REVIEWS.forEach(([segment, title, verdict, vibes, comment], i) => {
    const it = CATALOG[segment].find((x) => x.title === title);
    if (it) db.reviews[`${segment}:${it.id}`] = { segment, titleId: it.id, verdict, vibes, comment, date: ago(40 + i * 60) };
  });
  const up = CATALOG.anime.find((a) => a.unreleased);
  db.excited[`anime:${up.id}`] = {
    item: { id: up.id, segment: "anime", title: up.title, image: up.image, date: up.date },
    at: ago(12),
  };
  return db;
}

export { findItem };

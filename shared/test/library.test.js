import { test } from "node:test";
import assert from "node:assert/strict";
import { memoryStorage, daysAgo } from "./helpers.js";

const now = Date.now();
const it = (id, episodes) => ({ id, segment: "anime", title: `T${id}`, finished: true, episodes });
memoryStorage({ "voidation:db:v1": JSON.stringify({
  library: {
    "anime:1": { status: "watching", progress: 2, item: it(1, 12), updatedAt: daysAgo(1, now) },
    "anime:2": { status: "watching", progress: 2, item: it(2, 24), updatedAt: daysAgo(3, now), addedAt: daysAgo(2, now) },
    "anime:3": { status: "watching", progress: 2, item: it(3, null), updatedAt: daysAgo(9, now) },
  },
  // anime:1 was added 30 days ago and last watched 20 days ago; anime:3 watched yesterday
  log: [[now - 30 * 864e5, "anime:1", 0, "status:watching"], [now - 20 * 864e5, "anime:1", 1, "manual"], [now - 864e5, "anime:3", 1, "manual"]],
}) });

const { getLibrary, getLibraryDates, sortEntries } = await import("../backend/store.js");
const { applyPalette, THEMES, PALETTES } = await import("../theme.js");

test("library sorts: date added, last watched, longest", async () => {
  const list = Object.values(await getLibrary());
  const dates = await getLibraryDates();
  const ids = (sort) => sortEntries(list, sort, dates).map((e) => e.item.id);
  assert.deepEqual(ids("added"), [3, 2, 1]); // addedAt, else the first log line (anime:3: yesterday), else updatedAt
  assert.deepEqual(ids("watched"), [3, 2, 1]);
  assert.deepEqual(ids("longest"), [2, 1, 3]); // unknown length last
  assert.deepEqual(sortEntries(list, "added").map((e) => e.item.id).length, 3); // works without dates (website)
});

test("colour themes swap accents and keep pure black black", () => {
  const ember = PALETTES.find((p) => p.key === "ember");
  assert.equal(applyPalette(THEMES.void, "void", "ember").purple, ember.accent[0]);
  assert.equal(applyPalette(THEMES.void, "void", "ember").bg, ember.tint.bg);
  assert.equal(applyPalette(THEMES.black, "black", "ember").bg, "#000000");
  assert.equal(applyPalette(THEMES.pop, "pop", "ember").purple, ember.accent[1]);
  assert.equal(applyPalette(THEMES.void, "void", "void"), THEMES.void);
});

test("your people: counts titles, skips Plan to Watch, groups roles", async () => {
  const { tallyPeople } = await import("../peopleStats.js");
  const a = (id, status, genres) => ({ status, item: { id, segment: "anime", title: `A${id}`, genres } });
  const entries = [a(1, "completed", ["Action", "Drama"]), a(2, "watching", ["Action"]), a(3, "plan", ["Action"])];
  const credits = {
    "anime:1": { studios: [{ id: 9, name: "MAPPA" }], voices: [{ id: 5, name: "Kana" }], staff: [{ id: 7, name: "Dir", role: "Director" }, { id: 8, name: "Anim", role: "Animation Director (ep 3)" }] },
    "anime:2": { studios: [{ id: 9, name: "MAPPA" }], voices: [{ id: 5, name: "Kana" }], staff: [{ id: 10, name: "Mangaka", role: "Original Creator" }] },
    "anime:3": { studios: [{ id: 9, name: "MAPPA" }], voices: [], staff: [] },
  };
  const t = tallyPeople(entries, credits);
  assert.equal(t.counted, 2);
  assert.deepEqual(t.genres.map((g) => [g.name, g.count]), [["Action", 2], ["Drama", 1]]);
  assert.equal(t.studios[0].count, 2); // plan-to-watch title not counted
  assert.equal(t.voices[0].count, 2);
  assert.deepEqual(t.directors.map((d) => d.name), ["Dir"]); // animation director left out
  assert.deepEqual(t.creators.map((d) => d.name), ["Mangaka"]);
});

test("schedule order: Sunday to Saturday, pending first within a day", async () => {
  const { scheduleOrder } = await import("../backend/store.js");
  // local-time dates in one week: Sun 4 Oct 2026 … Sat 10 Oct 2026
  const at = (day, h) => ({ airingAt: new Date(2026, 9, day, h).getTime() / 1000 });
  const shows = [
    { id: "tue-caught", pending: 0, next: at(6, 8) },
    { id: "sun-caught", pending: 0, next: at(4, 9) },
    { id: "tue-3", pending: 3, next: at(6, 22) },
    { id: "mon-caught", pending: 0, next: at(5, 20) },
    { id: "sun-1", pending: 1, next: at(4, 23) },
    { id: "tue-1", pending: 1, next: at(6, 23) },
    { id: "done-2", pending: 2, next: null },
  ];
  assert.deepEqual([...shows].sort(scheduleOrder).map((x) => x.id),
    ["sun-1", "sun-caught", "mon-caught", "tue-1", "tue-3", "tue-caught", "done-2"]);
});

test("library kinds: anime, manga (incl. manhwa, manhua), novels", async () => {
  const { kindOf } = await import("../backend/store.js");
  const k = (segment, format, country) => kindOf({ segment, format, country });
  assert.deepEqual(
    [k("anime", "TV", "JP"), k("anime", "ONA", "CN"), k("manga", "MANGA", "JP"), k("manga", "MANGA", "KR"), k("manga", "NOVEL", "JP"), k("manga", "NOVEL", "KR"), k("manga", null, null)],
    ["anime", "anime", "manga", "manga", "novel", "novel", "manga"]);
});

// FILE: shared/demo/shelf.js — sample games and comics, used until the VoidPop server provides real ones (see shared/api/shelf.js).
// Every title here is invented (no real franchises) so nothing can be mistaken for real data; ids are "demo-game-N" and
// "demo-comic-N". There are no cover images yet: cards show a coloured title tile (item.color).
// Release times are worked out from today, so the countdowns always have something to count to.

const DAY = 86400;
const nowS = () => Math.floor(Date.now() / 1000);
const ymd = (s) => new Date(s * 1000).toISOString().slice(0, 10);
const dateLabel = (s) => new Date(s * 1000).toLocaleDateString("en", { day: "numeric", month: "short", year: "numeric" });

function game(n, title, color, genres, developer, platforms, hoursToBeat, daysFromNow, overview, extra = {}) {
  const releaseAt = nowS() + daysFromNow * DAY;
  const out = daysFromNow <= 0;
  return {
    id: `demo-game-${n}`, segment: "game", title, altTitle: null, image: null, imageSmall: null, color, banner: null,
    date: ymd(releaseAt), dateLabel: dateLabel(releaseAt), endDate: null, genres, genre: genres[0], overview, url: null,
    unreleased: !out, finished: out, format: "GAME", country: null, popularity: 100 - n, trending: null, score: null, favourites: null,
    episodes: null, chapters: null, nextEpisode: null, creator: developer, developer, platforms, hoursToBeat, releaseAt: out ? null : releaseAt,
    demo: true, ...extra,
  };
}
function comic(n, title, color, genres, writer, publisher, issues, nextInDays, overview, extra = {}) {
  const airingAt = nextInDays != null ? nowS() + nextInDays * DAY : null;
  return {
    id: `demo-comic-${n}`, segment: "comic", title, altTitle: null, image: null, imageSmall: null, color, banner: null,
    date: "2025-01-01", dateLabel: "2025", endDate: null, genres, genre: genres[0], overview, url: null,
    unreleased: false, finished: nextInDays == null, format: "COMIC", country: null, popularity: 100 - n, trending: null, score: null, favourites: null,
    episodes: null, chapters: issues, nextEpisode: null, creator: writer, writer, publisher,
    nextIssue: airingAt ? { issue: Math.min(issues, Math.max(1, Math.floor(issues / 4) + 1)), airingAt } : null,
    demo: true, ...extra,
  };
}

export const DEMO_GAMES = () => [
  game(1, "Starfall Drifter", "#2a6df4", ["Action RPG", "Sci-Fi"], "Lanternworks", ["PC", "PS5", "Switch"], 49, -12, "A salvage pilot follows a falling star across a broken galaxy. Fast ship combat, slow stories, and a crew you actually get attached to."),
  game(2, "Ember Court", "#e8704a", ["Strategy", "Fantasy"], "Cinder & Quill", ["PC", "Xbox"], 35, 23, "Rule a court of rival houses without ever raising your own banner. Every dinner is a battle, every favour a loan."),
  game(3, "Tidebound", "#19b394", ["Adventure", "Survival"], "Lowtide Studio", ["PC", "PS5", "Xbox"], 22, -40, "Sail between drowned towns, trade with ghosts, and learn what the sea wants back."),
  game(4, "Nine Lanterns", "#9b5de5", ["Puzzle", "Horror"], "Paper Moth Games", ["PC", "Switch"], 9, 60, "A lantern-lit house where every room is a puzzle and every puzzle is a memory. Short, strange and sad."),
  game(5, "Hollow Orchard", "#6a994e", ["Cozy", "Simulation"], "Fernhill", ["PC", "Switch", "Mobile"], 60, -90, "Bring a dead orchard back to life, one tree and one neighbour at a time."),
  game(6, "Gearwright", "#f2c14e", ["Platformer", "Indie"], "Brass Pocket", ["PC", "Switch"], 12, -200, "Build the machine that carries you through each level, then carry it through the next."),
  game(7, "Moth & Mirror", "#ef476f", ["Roguelike", "Action"], "Two Candles", ["PC", "PS5"], 30, 9, "Die in a palace of mirrors, remember everything, and break the loop one reflection at a time."),
  game(8, "Saltwind", "#118ab2", ["Racing", "Arcade"], "Gull Racing", ["PC", "Xbox", "PS5"], 15, -15, "Sail-powered hovercraft racing across salt flats at dawn. No brakes, only wind."),
  game(9, "Quiet Signal", "#5a189a", ["Mystery", "Narrative"], "Static Garden", ["PC", "Mobile"], 7, 120, "You are the night operator at a radio station that keeps receiving calls from the future."),
  game(10, "Brass Meridian", "#b5651d", ["RPG", "Steampunk"], "Meridian Forge", ["PC", "PS5", "Xbox"], 70, 200, "A sprawling airship RPG about a map that redraws itself whenever you stop looking."),
];

export const DEMO_COMICS = () => [
  comic(1, "Ashen Crown", "#f2c14e", ["Fantasy", "Drama"], "M. Okoro", "Hearth Press", 48, 6, "A burned kingdom, a crown nobody wants, and a thief who is the last heir."),
  comic(2, "Void Walkers", "#9b5de5", ["Sci-Fi", "Action"], "T. Lindqvist", "Northlight Comics", 24, 6, "Four strangers who can walk between stars, and one very patient hunter."),
  comic(3, "Redline", "#ef476f", ["Crime", "Thriller"], "R. Adeyemi", "Cold Ink", 60, 13, "A night-shift paramedic keeps arriving at crimes before they happen."),
  comic(4, "Moth City", "#19b394", ["Mystery", "Horror"], "S. Varga", "Paper Saints", 12, 20, "A city that only exists after midnight, and the people who work its streets."),
  comic(5, "Paper Saints", "#2a6df4", ["Fantasy", "Slice of Life"], "L. Moreau", "Paper Saints", 36, null, "Origami spirits look after a small town. Finished, and gently devastating."),
  comic(6, "Cold Harbor", "#118ab2", ["Noir", "Crime"], "J. Whitcombe", "Cold Ink", 30, 27, "A harbour town, a missing ferry, and a detective who gets seasick."),
  comic(7, "Iron Orchid", "#e8704a", ["Action", "Adventure"], "A. Nakamura-Reyes", "Hearth Press", 18, 3, "A retired mech pilot grows flowers in the cockpit, until the war comes back."),
  comic(8, "The Salt Road", "#6a994e", ["Western", "Drama"], "E. Brandt", "Northlight Comics", 8, null, "Two sisters cross a dry sea with a cart of salt and a lot of secrets. Complete."),
];

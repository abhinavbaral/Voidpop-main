// The genre filters in Browse. Some are AniList genres (Action, Romance…) and some are AniList TAGS
// (Isekai, Harem, Cyberpunk…): a genre is filtered with `genre`, a tag with `tag`. Each filter lists the
// AniList names it can be called, best first; resolveGenreFilters() checks them against AniList's own
// lists and keeps the first one that exists, so a filter is never sent with a name AniList doesn't know.
//   hint: what it means, shown under the chips.

const g = (name) => ({ kind: "genre", name });
const t = (name) => ({ kind: "tag", name });

export const GENRE_FILTERS = [
  { label: "Action", hint: "Physical conflict and fights", names: [g("Action")] },
  { label: "Adventure", hint: "Journeys, quests, and exploring", names: [g("Adventure")] },
  { label: "Boys' Love", hint: "Male-male romance", names: [t("Boys' Love"), t("Yaoi")] },
  { label: "Comedy", hint: "Humor and jokes", names: [g("Comedy")] },
  { label: "Cyberpunk", hint: "High-tech, low-life futures", names: [t("Cyberpunk")] },
  { label: "Drama", hint: "Heavy emotions and relationship conflicts", names: [g("Drama")] },
  { label: "Fantasy", hint: "Magic and mythical worlds", names: [g("Fantasy")] },
  { label: "Girls' Love", hint: "Female-female romance", names: [t("Girls' Love"), t("Yuri")] },
  { label: "Harem", hint: "One guy surrounded by multiple love interests", names: [t("Harem")] },
  { label: "Horror", hint: "Fear, gore, and monsters", names: [g("Horror")] },
  { label: "Isekai", hint: "Transported or reincarnated into another world", names: [t("Isekai")] },
  { label: "Iyashikei", hint: "Peaceful, healing, and low-stress stories", names: [t("Iyashikei")] },
  { label: "Magical Girl", hint: "Girls transforming to fight evil with magic", names: [g("Mahou Shoujo"), t("Magical Girl")] },
  { label: "Mecha", hint: "Giant piloted robots", names: [g("Mecha")] },
  { label: "Military", hint: "Warfare and armed forces", names: [t("Military")] },
  { label: "Music / Idol", hint: "Bands and pop star training", names: [g("Music")] },
  { label: "Mystery", hint: "Solving crimes and puzzles", names: [g("Mystery")] },
  { label: "Post-Apocalyptic", hint: "Life after the end of civilization", names: [t("Post-Apocalyptic"), t("Post-Apocalypse")] },
  { label: "Psychological", hint: "Mental battles and mind games", names: [g("Psychological")] },
  { label: "Reverse Harem", hint: "One girl surrounded by multiple love interests", names: [t("Reverse Harem")] },
  { label: "Romance", hint: "Love stories and dating", names: [g("Romance")] },
  { label: "Sci-Fi", hint: "Futuristic science and space travel", names: [g("Sci-Fi")] },
  { label: "Slice of Life", hint: "Everyday mundane routines", names: [g("Slice of Life")] },
  { label: "Space Opera", hint: "Space battles and galactic empires", names: [t("Space Opera")] },
  { label: "Sports", hint: "Athletic competitions and team training", names: [g("Sports")] },
  { label: "Steampunk", hint: "Steam-powered 19th-century tech", names: [t("Steampunk")] },
  { label: "Supernatural", hint: "Ghosts, gods, and spirits", names: [g("Supernatural")] },
  { label: "Suspense", hint: "Tension and high stakes", names: [t("Suspense"), g("Suspense")] },
  { label: "Thriller", hint: "Fast-paced excitement and danger", names: [g("Thriller")] },
];

// ’ and ' are the same letter to us; case doesn't matter
const norm = (s) => String(s).replace(/[’‘`]/g, "'").trim().toLowerCase();

// genres/tags = the names AniList has (arrays of strings; pass null if they couldn't be loaded and the
// first name of each filter is trusted). → { found: [{ key, label, hint, kind: "genre" | "tag", value }] in the
// list's order, missing: [labels AniList has no name for] }.
export function genreReport(genres, tags) {
  const have = { genre: genres ? new Set(genres.map(norm)) : null, tag: tags ? new Set(tags.map(norm)) : null };
  const out = [];
  const missing = [];
  GENRE_FILTERS.forEach((f) => {
    let hit = null;
    for (const n of f.names) {
      if (!have[n.kind]) { hit = hit || n; continue; } // that list didn't load: trust the first name
      const exact = (n.kind === "genre" ? genres : tags).find((x) => norm(x) === norm(n.name)); // AniList's own spelling
      if (exact) { hit = { kind: n.kind, name: exact }; break; }
    }
    if (hit) out.push({ key: f.label, label: f.label, hint: f.hint, kind: hit.kind, value: hit.name });
    else missing.push(f.label);
  });
  return { found: out, missing };
}

// the filters Browse shows (the ones AniList has a name for)
export const resolveGenreFilters = (genres, tags) => genreReport(genres, tags).found;

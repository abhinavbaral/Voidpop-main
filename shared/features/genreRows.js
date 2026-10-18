// The two genre rows on Explore are exact, not just "popular":
//   Isekai Heaven  anime tagged Isekai or Reincarnation. AniList has no "Reborn" tag;
//                  Reincarnation is the one that covers reborn and reincarnated stories.
//   Shonen Feast   shonen action: One Piece, Naruto, Bleach, My Hero Academia, Demon Slayer,
//                  Jujutsu Kaisen, JoJo… (the Shounen tag plus the Action genre; romance, sports
//                  and ecchi are left out)
// One place for the query and the clean-up, used by the first load and by Reroll.
const LEAVE_OUT_OF_SHONEN = ["Romance", "Sports", "Ecchi"];

export const GENRE_ROWS = {
  isekai: { query: { tags: ["Isekai", "Reincarnation"] }, leaveOut: [] },
  shonen: { query: { genre: "Action", tag: "Shounen", genreNotIn: LEAVE_OUT_OF_SHONEN }, leaveOut: LEAVE_OUT_OF_SHONEN },
};

// the extra AniList filters for a tile ({} for the tiles that aren't genre rows)
export const genreQuery = (key) => GENRE_ROWS[key]?.query || {};

// drops what doesn't belong in the row (items from other tiles pass through untouched)
export function genreFilter(key, items) {
  const out = GENRE_ROWS[key]?.leaveOut || [];
  return out.length ? items.filter((it) => !out.some((g) => it.genres?.includes(g))) : items;
}

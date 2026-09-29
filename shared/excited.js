// Runs the Excited → Watching move with fresh AniList data. Called when the
// app/site opens, when the app comes back to the front, and in the app's
// background job. Never throws: no internet just means "try next time".
import { fetchNextEpisodes } from "./api/anilist.js";
import { promoteExcited } from "./backend/store.js";

let running = null;
export function promoteExcitedNow() {
  if (!running) running = promoteExcited(fetchNextEpisodes).catch(() => []).finally(() => { running = null; });
  return running;
}

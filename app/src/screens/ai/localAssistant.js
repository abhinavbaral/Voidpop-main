import { getLibraryAll, getReviews, getCinemaShelf } from "@voidpop/shared/backend/store";
import { collectEntries, localReply, buildModelPrompt } from "@voidpop/shared/features/voidAi";

// What the assistant knows lives in shared/features/voidAi.js (tested there); this only loads your data for it.
// Everything you track, of every kind: the Library (anime, manga, novels), the shelf (movies, TV) and your verdicts.
export async function loadEntries() {
  const [library, reviews, shelf] = await Promise.all([
    getLibraryAll().catch(() => ({})),
    getReviews().catch(() => []),
    getCinemaShelf().catch(() => []),
  ]);
  return collectEntries({ library, reviews, shelf });
}

// The app can answer simple library-aware questions without network access or a model.
// This fallback is deliberately transparent: it is not presented as a generative LLM.
export async function makeLocalReply(question) {
  return localReply(question, await loadEntries());
}

export { buildModelPrompt };

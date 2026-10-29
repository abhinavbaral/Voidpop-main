import { getLibraryAll } from "@voidpop/shared/backend/store";

// The app can answer simple library-aware questions without network access or a model.
// This fallback is deliberately transparent: it is not presented as a generative LLM.
export async function makeLocalReply(question) {
  const library = await getLibraryAll().catch(() => ({}));
  const entries = Object.values(library || {}).filter((entry) => entry && entry.item);
  const titles = entries.map((entry) => ({
    title: (typeof entry.item?.title === "string" ? entry.item.title : null) || entry.item?.title?.english || entry.item?.title?.romaji || entry.item?.title?.userPreferred ||
      entry.item?.name || "Untitled",
    status: String(entry.status || "unknown").toLowerCase(),
    segment: entry.item?.segment || "anime",
  }));
  const q = String(question || "").toLowerCase();
  const count = (status) => titles.filter((item) => item.status === status).length;
  const sample = (status, max = 6) => titles.filter((item) => item.status === status).slice(0, max).map((item) => item.title);
  const librarySummary = `Your local library currently has ${titles.length} entries: ${count("watching")} watching, ${count("completed")} completed, ${count("plan")} planned, and ${count("dropped")} dropped.`;

  if (/\b(hello|hi|hey|what can you do)\b/.test(q)) {
    return `Hey! I'm Void AI. I can help you explore your tracking habits and find things in your library. ${librarySummary}\n\nFor generative conversations, import a compatible .litertlm model using the model button above.`;
  }
  if (/\b(dropped|drop list|what did i drop)\b/.test(q)) {
    const list = sample("dropped");
    return list.length ? `Here are some titles marked Dropped in your library:\n${list.map((title) => `• ${title}`).join("\n")}${count("dropped") > list.length ? `\n…and ${count("dropped") - list.length} more.` : ""}` :
      "I couldn't find any titles marked Dropped in the local library.";
  }
  if (/\b(completed|finished|watched|read)\b/.test(q)) {
    const list = sample("completed");
    return `${librarySummary}\n\n${list.length ? `Some completed titles:\n${list.map((title) => `• ${title}`).join("\n")}` : "I couldn't find completed titles in the local library."}`;
  }
  if (/\b(watching|continue|currently)\b/.test(q)) {
    const list = sample("watching");
    return `${count("watching")} entries are marked Watching.\n\n${list.length ? list.map((title) => `• ${title}`).join("\n") : "Nothing is marked Watching right now."}`;
  }
  if (/\b(library|how many|stats|statistics|my list)\b/.test(q)) return librarySummary;
  return `I'm running in **Local Quick Mode**, so I can answer simple questions using your on-device library, but I don't have a language model loaded yet.\n\n${librarySummary}\n\nTo enable generative replies, tap **Load model** and select a compatible `.litertlm` model file. Your message stays on this device.`;
}

export function buildModelPrompt(question, libraryContext = "") {
  return [
    "You are Void AI, the friendly assistant inside Voidation/VoidPop, an anime, manga, novel, movie and series tracker.",
    "Be concise, useful and honest. Never invent library data, release dates, episode counts, catalogue facts, or personal preferences.",
    "Use only the supplied context for claims about this user's library. If context is missing, say so. Do not claim to have searched the internet.",
    "Do not reveal spoilers unless the user explicitly asks. Do not change library data; this assistant is read-only.",
    libraryContext ? `Local library context:\n${libraryContext}` : "No library context was supplied.",
    `User message: ${question}`,
    "Reply in natural language."
  ].join("\n\n");
}

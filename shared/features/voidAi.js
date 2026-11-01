// Void AI's thinking that needs no phone, so it can be tested: what it knows about your library, the quick answers it
// gives without a model, and the prompt it builds for one. The screen and the native model runtime live in the app.
//
// "Everything you track" means every kind: the Library (anime, manga, novels) and the shelf (movies, TV), each with
// the Void Verdict you gave it.
import { VERDICTS, kindOf } from "../backend/store.js";

const KINDS = ["anime", "manga", "novel", "movie", "tv"];
const SINGULAR = { anime: "anime", manga: "manga", novel: "novel", movie: "movie", tv: "TV show" };
const PLURAL = { anime: "anime", manga: "manga", novel: "novels", movie: "movies", tv: "TV shows" };

const stamp = (v) => { const t = typeof v === "number" ? v : Date.parse(v || ""); return Number.isFinite(t) ? t : 0; };
// a title goes into a line of a prompt: no newlines or bars (so a title can't pose as an instruction or a new row), and not too long
const clean = (s, max = 80) => String(s ?? "").replace(/[\r\n|]+/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
const verdictLabel = (key) => VERDICTS.find((v) => v.key === key)?.label || "";

export function titleOf(item = {}) {
  const t = item.title;
  return clean((typeof t === "string" ? t : null) || t?.english || t?.romaji || t?.userPreferred || item.name) || "Untitled";
}

// → [{ title, kind, status, verdict (a label or ""), at }] for the Library and the shelf together
export function collectEntries({ library = {}, reviews = [], shelf = [] } = {}) {
  const verdicts = new Map((reviews || []).map((r) => [`${r.segment}:${r.titleId}`, r.verdict]));
  const out = [];
  Object.entries(library || {}).forEach(([key, e]) => {
    if (!e?.item) return;
    out.push({ title: titleOf(e.item), kind: kindOf(e.item), status: String(e.status || "unknown").toLowerCase(), verdict: verdictLabel(verdicts.get(key)), at: stamp(e.updatedAt) });
  });
  (shelf || []).forEach((e) => {
    if (!e?.item) return;
    out.push({ title: titleOf(e.item), kind: e.item.segment === "tv" ? "tv" : "movie", status: String(e.status || "unknown").toLowerCase(), verdict: verdictLabel(e.review?.verdict), at: stamp(e.updatedAt) });
  });
  return out;
}

const count = (entries, fn) => entries.filter(fn).length;
const finished = (e) => e.status === "completed" || e.status === "rewatching";

export function summarize(entries) {
  const n = entries.length;
  const kinds = KINDS.map((k) => [k, count(entries, (e) => e.kind === k)]).filter(([, c]) => c > 0).map(([k, c]) => `${c} ${c === 1 ? SINGULAR[k] : PLURAL[k]}`);
  return `Your library has ${n} ${n === 1 ? "title" : "titles"}${kinds.length ? ` (${kinds.join(", ")})` : ""}: `
    + `${count(entries, (e) => e.status === "watching")} watching, ${count(entries, finished)} completed, `
    + `${count(entries, (e) => e.status === "plan")} planned and ${count(entries, (e) => e.status === "dropped")} dropped.`;
}

const bullets = (list) => list.map((e) => `• ${e.title}${e.kind === "anime" ? "" : ` (${SINGULAR[e.kind]})`}`).join("\n");
function listOf(entries, test, max = 6) {
  const all = entries.filter(test);
  const shown = all.slice(0, max);
  return { all, text: bullets(shown) + (all.length > shown.length ? `\n…and ${all.length - shown.length} more.` : "") };
}

// A short answer with no model: counts and lists from your own library. Deliberately not presented as a language model.
export function localReply(question, entries) {
  const q = String(question || "").toLowerCase();
  const summary = summarize(entries);
  if (/\b(hello|hi|hey|what can you do|can you help)\b/.test(q)) {
    return `Hey! I'm Void AI. I can help you explore your tracking habits and find things in your library. ${summary}\n\nFor generative conversations, import a compatible .litertlm model using the model button above.`;
  }
  if (/\b(dropped|drop list|what did i drop)\b/.test(q)) {
    const l = listOf(entries, (e) => e.status === "dropped");
    return l.all.length ? `Here are some titles marked Dropped in your library:\n${l.text}` : "I couldn't find any titles marked Dropped in your library.";
  }
  if (/\b(plan|planned|planning|watchlist|want to (watch|read))\b/.test(q)) {
    const l = listOf(entries, (e) => e.status === "plan");
    return l.all.length ? `${l.all.length} ${l.all.length === 1 ? "title is" : "titles are"} on your Plan list:\n${l.text}` : "Nothing is on your Plan list right now.";
  }
  if (/\b(completed|finished|watched|read)\b/.test(q)) {
    const l = listOf(entries, finished);
    return `${summary}\n\n${l.all.length ? `Some completed titles:\n${l.text}` : "I couldn't find completed titles in your library."}`;
  }
  if (/\b(watching|reading|continue|currently|in progress)\b/.test(q)) {
    const l = listOf(entries, (e) => e.status === "watching");
    return `${l.all.length} ${l.all.length === 1 ? "entry is" : "entries are"} marked Watching.\n\n${l.all.length ? l.text : "Nothing is marked Watching right now."}`;
  }
  if (/\b(library|how many|stats|statistics|my list)\b/.test(q)) return summary;
  return `I'm running in **Local Quick Mode**, so I can answer simple questions using your on-device library, but I don't have a language model loaded yet.\n\n${summary}\n\nTo enable generative replies, tap **Load model** and select a compatible \`.litertlm\` model file. Your message stays on this device.`;
}

// What a model is told about your library: the counts, then the titles that say the most about your taste (the ones you gave
// a verdict, newest first), as many as fit. A small on-device model only has room for so much, and a first-80-in-storage-order
// cut (the old way) mostly showed whatever was added first.
export function libraryContext(entries, { maxLines = 60, maxChars = 3000 } = {}) {
  if (!entries.length) return "";
  const ranked = [...entries].sort((a, b) => (b.verdict ? 1 : 0) - (a.verdict ? 1 : 0) || b.at - a.at);
  const lines = [];
  let used = 0;
  for (const e of ranked) {
    const line = `${e.title} | ${SINGULAR[e.kind] || e.kind} | ${e.status}${e.verdict ? ` | verdict: ${e.verdict}` : ""}`;
    if (lines.length >= maxLines || used + line.length + 1 > maxChars) break;
    lines.push(line);
    used += line.length + 1;
  }
  const more = entries.length - lines.length;
  return `${summarize(entries)}\n${lines.join("\n")}${more > 0 ? `\n(${more} more titles not shown)` : ""}`;
}

// The model gets one message at a time and remembers nothing between them, so the chat so far goes inside the prompt.
// history: [{ role, text, skip? }]. Messages marked skip (the greeting, canned quick answers, errors) are left out, and only
// the last few turns are kept so the library still fits.
export function buildModelPrompt(question, libraryContextText = "", history = []) {
  const turns = (history || [])
    .filter((m) => m && !m.skip && (m.role === "user" || m.role === "assistant") && String(m.text || "").trim())
    .slice(-6)
    .map((m) => `${m.role === "user" ? "User" : "Void AI"}: ${clean(m.text, 400)}`);
  return [
    "You are Void AI, the friendly assistant inside Voidation/VoidPop, an anime, manga, novel, movie and series tracker.",
    "Be concise, useful and honest. Never invent library data, release dates, episode counts, catalogue facts, or personal preferences.",
    "Use only the supplied context for claims about this user's library. If context is missing, say so. Do not claim to have searched the internet.",
    "Do not reveal spoilers unless the user explicitly asks. Do not change library data; this assistant is read-only.",
    libraryContextText ? `Local library context:\n${libraryContextText}` : "No library context was supplied.",
    turns.length ? `Conversation so far:\n${turns.join("\n")}` : null,
    `User message: ${question}`,
    "Reply in natural language.",
  ].filter(Boolean).join("\n\n");
}

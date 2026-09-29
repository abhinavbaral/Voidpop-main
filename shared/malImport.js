// Import a MyAnimeList list from MAL's own export file — no MAL API involved.
// On myanimelist.net: Profile → Export Lists (panel.php?go=export) gives an
// .xml.gz file (anime or manga). We read it, look the titles up on AniList by
// their MAL id (AniList stores it), and add them to your library.
import { gunzipSync, strFromU8 } from "fflate";
import { fetchByMalIds } from "./api/anilist.js";
import { importMalEntries } from "./backend/store.js";

// bytes (Uint8Array) of .xml or .xml.gz → XML text
export function malFileToText(bytes) {
  const gz = bytes[0] === 0x1f && bytes[1] === 0x8b;
  return strFromU8(gz ? gunzipSync(bytes) : bytes);
}

// base64 → Uint8Array (for files read by the app as base64)
export function base64ToBytes(b64) {
  const bin = typeof atob === "function" ? atob(b64) : globalThis.Buffer.from(b64, "base64").toString("binary");
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

const tag = (block, name) => {
  const m = block.match(new RegExp(`<${name}>\\s*(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?\\s*</${name}>`));
  return m ? m[1].trim() : "";
};

// MAL writes statuses as words (newer exports) or numbers (older ones)
const STATUS = {
  watching: "watching", reading: "watching", completed: "completed", "on-hold": "onhold",
  dropped: "dropped", "plan to watch": "plan", "plan to read": "plan",
  1: "watching", 2: "completed", 3: "onhold", 4: "dropped", 6: "plan",
};

// → { anime: [...], manga: [...] }, each { malId, title, status, progress, times }
export function parseMalXml(xml) {
  const out = { anime: [], manga: [] };
  for (const [seg, idTag, progTag, againTag, timesTag] of [
    ["anime", "series_animedb_id", "my_watched_episodes", "my_rewatching", "my_times_watched"],
    ["manga", "manga_mangadb_id", "my_read_chapters", "my_rereading", "my_times_read"],
  ]) {
    const blocks = xml.match(new RegExp(`<${seg}>[\\s\\S]*?</${seg}>`, "g")) || [];
    for (const b of blocks) {
      const malId = Number(tag(b, idTag));
      let status = STATUS[tag(b, "my_status").toLowerCase()];
      if (!malId || !status) continue;
      if (tag(b, againTag) === "1") status = "rewatching";
      out[seg].push({
        malId,
        title: tag(b, seg === "anime" ? "series_title" : "manga_title"),
        status,
        progress: Number(tag(b, progTag)) || 0,
        times: Number(tag(b, timesTag)) || 0,
      });
    }
  }
  return out;
}

// The whole import: file bytes → { added, kept, notFound: [titles], total }
export async function importMalFile(bytes) {
  const parsed = parseMalXml(malFileToText(bytes));
  const entries = [];
  const notFound = [];
  for (const seg of ["anime", "manga"]) {
    const list = parsed[seg];
    if (!list.length) continue;
    const found = await fetchByMalIds(seg, list.map((x) => x.malId));
    list.forEach((x) => (found[x.malId] ? entries.push({ ...x, item: found[x.malId] }) : notFound.push(x.title)));
  }
  const total = parsed.anime.length + parsed.manga.length;
  if (!total) throw new Error("That file has no MyAnimeList entries. Pick the .xml or .xml.gz from MAL's Export page.");
  const r = await importMalEntries(entries);
  return { ...r, notFound, total };
}

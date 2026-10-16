#!/usr/bin/env node
// Adds shows to the filler database (shared/data/fillers.js) from animefillerlist.com.
//
//   node tools/build-filler.mjs <anilistId> <afl-page-name> [--offset N] [--total N] [--dry]
//   node tools/build-filler.mjs --list tools/filler-shows.txt [--seasons] [--dry]
//   node tools/build-filler.mjs <anilistId> <afl-page-name> --file saved-page.html
//
//   <anilistId>       the number in the show's AniList address: anilist.co/anime/20/Naruto → 20
//   <afl-page-name>   the last part of the show's address: animefillerlist.com/shows/naruto → naruto
//   --seasons         find every TV season of the show through AniList's prequel/sequel links and work out
//                     each season's offset by adding up the episodes of the seasons before it. It saves the
//                     show only if the seasons add up to the episode count on the site's page; if not, the
//                     show is listed at the end for you to do by hand. Lines with their own offset are left alone.
//   --offset N        by hand: the site numbers a whole franchise in one run, AniList splits it into seasons.
//                     AniList episode = site episode − N. If this AniList entry is the site's episodes
//                     51-100, its first episode is the site's 51 → --offset 50. A show that starts at 1 needs none.
//   --total N         the entry's episode count (looked up on AniList when left out)
//   --force           save a show even though the site and AniList disagree about its episode count
//   --file page.html  read a saved copy of the page instead of downloading it
//   --list file       one show per line: "anilistId afl-page-name [offset [total]]", # for comments
//   --dry             show what would be saved without writing anything
//
// Be kind to the site: shows are fetched one at a time with a pause between them.
// Check each result against the page before you trust it, and see Docs/Fillers.md.
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseEpisodeTable, toEntry, walkSeasons, planSeasons, parseJobList, MEDIA_QUERY } from "./lib/afl.mjs";
import { checkFillerDb } from "../shared/features/fillers.js";

const DB_FILE = fileURLToPath(new URL("../shared/data/fillers.js", import.meta.url));
const SITE = "https://www.animefillerlist.com/shows/";
const PAUSE_MS = 2000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function args(argv) {
  const flags = {};
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith("--")) {
      const k = argv[i].slice(2);
      flags[k] = ["dry", "help", "seasons", "force"].includes(k) ? true : argv[++i];
    } else rest.push(argv[i]);
  }
  return { flags, rest };
}

const mediaCache = new Map();
// one AniList entry with its relations (cached; waits and retries when AniList says "too many requests")
async function getMedia(id) {
  if (mediaCache.has(id)) return mediaCache.get(id);
  for (let tries = 0; tries < 4; tries++) {
    await sleep(1000); // AniList allows about 90 requests a minute
    const res = await fetch("https://graphql.anilist.co", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      signal: AbortSignal.timeout(10000),
      body: JSON.stringify({ query: MEDIA_QUERY, variables: { id: Number(id) } }),
    });
    if (res.status === 429) { await sleep((Number(res.headers.get("retry-after")) || 30) * 1000); continue; }
    if (!res.ok) throw new Error(`AniList said ${res.status}`);
    const m = (await res.json()).data?.Media;
    if (!m) throw new Error(`AniList has no anime with id ${id}`);
    mediaCache.set(id, m);
    return m;
  }
  throw new Error("AniList kept saying 'too many requests'");
}

const nameOf = (m) => m.title.english || m.title.romaji;

// One list line → the entries it produces, plus anything you should look at.
//   with --seasons and no offset on the line: every TV season is found through AniList's sequel links
//   otherwise: just the one entry (offset and total from the line, or 0 and whatever AniList says)
async function build({ id, afl, offset, total, file }) {
  const html = file ? await readFile(file, "utf8") : await (async () => {
    const res = await fetch(SITE + afl, { headers: { "User-Agent": "VoidPop filler builder (personal use, one page at a time)" } });
    if (!res.ok) throw new Error(`animefillerlist.com said ${res.status} for ${afl}`);
    return res.text();
  })();
  const episodes = parseEpisodeTable(html);
  if (!episodes.length) throw new Error(`no episode table found for "${afl}": is the page name right, or has the site's layout changed?`);
  const pageLast = Math.max(...episodes.map((e) => e.number));

  let seasons;
  let problem = null;
  if (flags.seasons && offset === undefined && total === undefined) {
    const chain = await walkSeasons(id, getMedia);
    const plan = planSeasons(chain, pageLast);
    seasons = plan.seasons;
    problem = plan.why;
    if (!seasons.length) seasons = [{ id: Number(id), name: afl, offset: 0, total: null }];
  } else {
    let name = afl;
    let known = total ? Number(total) : null;
    try { const m = await getMedia(id); name = nameOf(m); known = known ?? (m.episodes || null); } catch (e) { console.warn(`  (couldn't look up AniList: ${e.message})`); }
    const off = Number(offset) || 0;
    seasons = [{ id: Number(id), name, offset: off, total: known }];
    if (known && pageLast - off !== known) problem = `the site's episodes run to ${pageLast}${off ? ` (${pageLast - off} after the offset)` : ""} but AniList says ${known}: wrong offset, or a different season or cut of the show`;
  }

  const items = seasons.map((s) => {
    const { entry, counts } = toEntry(episodes, { offset: s.offset, total: s.total });
    return { id: String(s.id), value: { name: s.name, afl, ...entry }, counts, season: s };
  });
  return { items, problem, listed: episodes.length, pageLast };
}

// rewrite the database file: keep the header comment, write every entry on one line, sorted by id
async function save(newEntries) {
  const text = await readFile(DB_FILE, "utf8");
  const head = text.slice(0, text.indexOf("export default {"));
  const current = (await import(pathToFileURL(DB_FILE).href + `?t=${Date.now()}`)).default;
  const merged = { ...current };
  const rejected = [];
  newEntries.forEach((e) => {
    const bad = checkFillerDb({ [e.id]: e.value });
    if (bad.length) rejected.push(`${e.value.afl} (${e.id}): ${bad.join("; ")}`);
    else merged[e.id] = e.value;
  });
  const lines = Object.keys(merged).sort((a, b) => Number(a) - Number(b)).map((id) => {
    const v = merged[id];
    return `  ${id}: { name: ${JSON.stringify(v.name)}, afl: ${JSON.stringify(v.afl)}, filler: ${JSON.stringify(v.filler || "")}, animeCanon: ${JSON.stringify(v.animeCanon || "")}, mixed: ${JSON.stringify(v.mixed || "")} },`;
  });
  await writeFile(DB_FILE, `${head}export default {\n${lines.join("\n")}${lines.length ? "\n" : ""}};\n`);
  return rejected;
}

const { flags, rest } = args(process.argv.slice(2));
if (flags.help || (!flags.list && rest.length < 2)) {
  console.log(`Usage:
  node tools/build-filler.mjs <anilistId> <afl-page-name> [--offset N] [--total N] [--file page.html] [--dry]
  node tools/build-filler.mjs --list tools/filler-shows.txt [--seasons] [--force] [--dry]
See the top of this file or Docs/Fillers.md for what each part means.`);
  process.exit(flags.help ? 0 : 1);
}

let jobs;
const badLines = [];
if (flags.list) {
  const parsed = parseJobList(await readFile(flags.list, "utf8"));
  jobs = parsed.jobs;
  badLines.push(...parsed.problems);
  parsed.problems.forEach((p) => console.error(`  ignored ${p}`));
} else {
  jobs = [{ id: rest[0], afl: rest[1], offset: flags.offset, total: flags.total, file: flags.file }];
}

if (!jobs.length) {
  console.log(`No shows found in ${flags.list}. Add one per line, without a # in front, like:\n  20 naruto\nThen run this again.`);
  process.exit(1);
}

let saved = 0;
const manual = [...badLines];
for (let i = 0; i < jobs.length; i++) {
  const j = jobs[i];
  try {
    console.log(`\n${j.afl} (AniList ${j.id})`);
    const r = await build(j);
    console.log(`  the site's page lists ${r.listed} episodes, up to number ${r.pageLast}`);
    r.items.forEach(({ id, value, counts, season }) => {
      console.log(`  → AniList ${id} "${value.name}"${r.items.length > 1 ? `, episodes ${season.offset + 1}-${season.total ? season.offset + season.total : "…"} on the site (offset ${season.offset})` : ""}`);
      console.log(`    filler ${counts.filler} · anime canon ${counts.animeCanon} · mixed ${counts.mixed} · canon ${counts.canon}${counts.dropped ? ` · ${counts.dropped} outside this entry` : ""}`);
      console.log(`    filler: ${value.filler || "-"}   animeCanon: ${value.animeCanon || "-"}   mixed: ${value.mixed || "-"}`);
    });
    if (r.problem && !flags.force) {
      console.log(`  CHECK, not saved: ${r.problem}.\n  Fix it by hand (offset/total on the line) or save anyway with --force.`);
      manual.push(`${j.afl}: ${r.problem}`);
    } else {
      if (r.problem) console.log(`  CHECK (saved because of --force): ${r.problem}`);
      if (flags.dry) saved += r.items.length;
      else {
        // saved right away, show by show, so a failure later in a long run loses nothing
        const rejected = await save(r.items);
        saved += r.items.length - rejected.length;
        rejected.forEach((x) => { console.log(`  not saved: ${x}`); manual.push(x); });
      }
    }
  } catch (e) {
    console.error(`  skipped: ${e.message}`);
    manual.push(`${j.afl}: ${e.message}`);
  }
  if (i < jobs.length - 1 && !jobs[i].file) await sleep(PAUSE_MS);
}
console.log(`\n${flags.dry ? "--dry: nothing saved. " : ""}${saved} entr${saved === 1 ? "y" : "ies"} ${flags.dry ? "would be saved" : "saved to shared/data/fillers.js"}${manual.length ? `, ${manual.length} thing${manual.length === 1 ? "" : "s"} need${manual.length === 1 ? "s" : ""} you:` : "."}`);
manual.forEach((m) => console.log(`  - ${m}`));

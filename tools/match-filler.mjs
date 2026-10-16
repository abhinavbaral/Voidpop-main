#!/usr/bin/env node
// Makes the list of shows for the filler builder, so you don't type ids by hand.
//
//   node tools/match-filler.mjs [--out tools/filler-candidates.txt] [--limit N] [--file shows.html]
//
// 1. downloads animefillerlist.com's list of shows (the page names are copied from the site,
//    so they are always exact),
// 2. looks each one up on AniList by title, one at a time with a pause (AniList's limit is about 90
//    requests a minute),
// 3. writes tools/filler-candidates.txt for YOU TO CHECK:
//      20 naruto            # Naruto = AniList "Naruto" (TV, 220 eps, 2002)      ← exact title match, ready
//      # CHECK 1535 deathnote  # Death Note ≟ AniList "Death Note: Rewrite"      ← not sure: fix, then remove "# CHECK "
//      # NOT FOUND some-show  # Some Show                                         ← nothing on AniList
// Lines that start with # are skipped by the builder, so only the exact matches get built until you
// look at the rest. Copy the lines you trust into tools/filler-shows.txt and run build-filler.mjs.
//
// A title can only match ONE AniList entry (usually season 1). Later seasons are separate AniList
// entries: add them yourself with an offset (see Docs/Fillers.md). The builder warns when the
// page and AniList disagree about the episode count, which is how you spot those.
import { readFile, writeFile } from "node:fs/promises";
import { parseShowList, pickMatch } from "./lib/afl.mjs";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const argv = process.argv.slice(2);
const flag = (k, d) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : d; };
const out = flag("out", "tools/filler-candidates.txt");
const limit = Number(flag("limit", 0)) || Infinity;

const html = flag("file") ? await readFile(flag("file"), "utf8") : await (await fetch("https://www.animefillerlist.com/shows", { headers: { "User-Agent": "VoidPop filler builder (personal use)" } })).text();
const shows = parseShowList(html).slice(0, limit);
if (!shows.length) { console.error("Found no shows on the page: has the site's layout changed?"); process.exit(1); }
console.log(`${shows.length} shows on the site. Looking each one up on AniList (about ${Math.ceil(shows.length * 1.2 / 60)} minutes)...`);

const QUERY = "query($q:String){Page(perPage:6){media(search:$q,type:ANIME,sort:SEARCH_MATCH){id title{romaji english} format episodes startDate{year}}}}";
async function search(q, tries = 3) {
  for (let i = 0; i < tries; i++) {
    const res = await fetch("https://graphql.anilist.co", { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify({ query: QUERY, variables: { q } }), signal: AbortSignal.timeout(10000) });
    if (res.status === 429) { await sleep((Number(res.headers.get("retry-after")) || 30) * 1000); continue; }
    if (!res.ok) throw new Error(`AniList said ${res.status}`);
    return (await res.json()).data.Page.media;
  }
  throw new Error("AniList kept saying 'too many requests'");
}

const lines = [
  "# Candidates from tools/match-filler.mjs. CHECK every line before you trust it.",
  "# Exact title matches are active lines. Everything else starts with # and is not built until you fix it.",
  "# Format: anilistId afl-page-name [offset [total]]",
  "",
];
let sure = 0;
for (let i = 0; i < shows.length; i++) {
  const { name, slug } = shows[i];
  try {
    const m = pickMatch(name, await search(name));
    if (!m) { lines.push(`# NOT FOUND ${slug}   # ${name}`); }
    else {
      const r = m.result;
      const t = r.title.english || r.title.romaji;
      const info = `${name} ${m.sure ? "=" : "≟"} AniList "${t}" (${r.format}, ${r.episodes ?? "?"} eps, ${r.startDate?.year ?? "?"})`;
      lines.push(m.sure ? `${r.id} ${slug}   # ${info}` : `# CHECK ${r.id} ${slug}   # ${info}`);
      if (m.sure) sure++;
    }
  } catch (e) {
    lines.push(`# FAILED ${slug}   # ${name}: ${e.message}`);
  }
  if ((i + 1) % 20 === 0) console.log(`  ${i + 1} / ${shows.length}`);
  await sleep(1200);
}
await writeFile(out, lines.join("\n") + "\n");
console.log(`\nWrote ${out}: ${sure} exact matches, ${shows.length - sure} to check.`);

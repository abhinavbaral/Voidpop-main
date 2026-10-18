#!/usr/bin/env node
// Shows how the 29 Browse genre filters map onto AniList: which are AniList genres, which are tags, and
// any AniList has no name for (those are left out of Browse).   node tools/check-genres.mjs
import { genreReport } from "../shared/features/genres.js";

const res = await fetch("https://graphql.anilist.co", {
  method: "POST",
  headers: { "Content-Type": "application/json", Accept: "application/json" },
  body: JSON.stringify({ query: "query { GenreCollection MediaTagCollection { name isAdult } }" }),
  signal: AbortSignal.timeout(15000),
});
if (!res.ok) { console.error(`AniList said ${res.status}`); process.exit(1); }
const d = (await res.json()).data;
const tags = d.MediaTagCollection.filter((t) => !t.isAdult).map((t) => t.name);
const { found, missing } = genreReport(d.GenreCollection, tags);

console.log(`AniList has ${d.GenreCollection.length} genres and ${tags.length} tags.\n`);
found.forEach((f) => console.log(`  ${f.label.padEnd(18)} → ${f.kind.padEnd(5)} "${f.value}"`));
console.log(missing.length ? `\nNo matching name on AniList (left out of Browse): ${missing.join(", ")}` : "\nAll filters found.");
if (missing.length) {
  console.log("\nTo fix one, add the name AniList uses to that filter in shared/features/genres.js.");
  console.log("Names to pick from, tags that contain a word you'd expect:");
  missing.forEach((m) => {
    const word = m.split(/[ /'-]/)[0].toLowerCase();
    const near = tags.filter((t) => t.toLowerCase().includes(word)).slice(0, 6);
    console.log(`  ${m}: ${near.length ? near.join(", ") : "(nothing close)"}`);
  });
}

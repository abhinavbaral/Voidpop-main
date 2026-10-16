// The filler database: which episodes of an anime are filler, anime canon or mixed.
//
//   AniList id → { name, afl, filler, animeCanon, mixed }
//
//   name        the title, for you (the app uses AniList's own title)
//   afl         the show's page name on animefillerlist.com (where the data came from)
//   filler      episode numbers as ranges: "26,97,101-106"
//   animeCanon  anime-original episodes that the anime treats as canon
//   mixed       part canon, part filler (shown in the guide, but not skippable)
//
// Episode numbers are the numbers of THIS AniList entry (each season has its own
// id and starts at episode 1), not the franchise-wide numbers. Episodes in none of
// the lists are canon. Leave a list "" when there is nothing in it.
//
// Don't edit by hand if you can avoid it: add shows with the builder, then check
// the numbers against the page.      node tools/build-filler.mjs --help
// Format and workflow: Docs/Fillers.md
//
// An entry looks like this (made-up numbers, this is only an example):
//   9999999: { name: "Example Show", afl: "example-show", filler: "26,97,101-106", animeCanon: "", mixed: "50-52" },
export default {
};

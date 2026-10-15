import { test } from "node:test";
import assert from "node:assert/strict";
import { officialYouTube } from "../features/officialYouTube.js";

const yt = (extra) => ({ site: "YouTube", type: "STREAMING", url: "https://www.youtube.com/playlist?list=PL1", ...extra });

test("licensed channels show; channel comes from the note or the URL", () => {
  assert.deepEqual(officialYouTube([yt({ notes: "Muse Asia" })]), ["Muse Asia"]);
  assert.deepEqual(officialYouTube([yt({ url: "https://www.youtube.com/@AniOneAsia/videos" })]), ["Ani-One Asia"]);
});

test("unknown channels, dub channels and disabled links are hidden", () => {
  assert.deepEqual(officialYouTube([yt({ notes: "Some Random Uploads" })]), []);
  assert.deepEqual(officialYouTube([yt()]), []); // no channel named: can't say it is licensed
  assert.deepEqual(officialYouTube([yt({ notes: "Muse Asia English Dub" })]), []);
  assert.deepEqual(officialYouTube([yt({ notes: "Muse Asia", isDisabled: true })]), []);
  assert.deepEqual(officialYouTube([{ site: "Crunchyroll", url: "https://crunchyroll.com", notes: "Muse Asia" }]), []);
});

test("each channel once", () => {
  assert.deepEqual(officialYouTube([yt({ notes: "Muse Asia" }), yt({ notes: "muse asia", language: "English" })]), ["Muse Asia"]);
});

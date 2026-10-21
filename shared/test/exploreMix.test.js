// Explore's mixing helpers: taking kinds in turns, "like this one" lists, the Billboard pick.
import { test } from "node:test";
import assert from "node:assert/strict";
import { interleave, likeMix, billboardPick } from "../features/exploreMix.js";

const item = (id, segment = "anime", extra = {}) => ({ id, segment, title: `${segment} ${id}`, genres: [], ...extra });
const ids = (list) => list.map((x) => `${x.segment}:${x.id}`);

test("interleave takes one from each list in turn, keeps a repeat once, and stops at the limit", () => {
  const a = [item(1), item(2), item(3)];
  const b = [item(1, "movie"), item(2, "movie")];
  const c = [item(1), item(9)]; // anime:1 is already in the first list
  assert.deepEqual(ids(interleave([a, b, c])), ["anime:1", "movie:1", "anime:9", "anime:2", "movie:2", "anime:3"]);
  assert.equal(interleave([a, b, c], 4).length, 4);
  assert.deepEqual(ids(interleave([a], 2)), ["anime:1", "anime:2"]);
});

test("interleave doesn't mind lists that haven't loaded yet", () => {
  assert.deepEqual(interleave([undefined, null, [item(1)], []]).map((x) => x.id), [1]);
  assert.deepEqual(interleave(undefined), []);
  assert.deepEqual(interleave([]), []);
});

test("like mix: its own recommendations come first, with shows of every kind that share its genres woven in", () => {
  const source = item(1, "anime", { genres: ["Action", "Fantasy"] });
  const recs = Array.from({ length: 9 }, (_, i) => item(100 + i));
  const pools = {
    anime: [item(1, "anime", { genres: ["Action"] }), item(200, "anime", { genres: ["Action"] })], // 1 is the source itself
    manga: [item(300, "manga", { genres: ["Romance"] }), item(301, "manga", { genres: ["Fantasy", "Action"] })],
    movie: [item(400, "movie", { genres: ["Action"] }), item(401, "movie", { genres: ["Action", "Fantasy"] }), item(402, "movie", { genres: ["Fantasy"] }), item(403, "movie", { genres: ["Action"] })],
    tv: [item(500, "tv", { genres: ["Drama"] })],
  };
  const out = likeMix(source, recs, pools);
  assert.deepEqual(ids(out.slice(0, 3)), ["anime:100", "anime:101", "anime:102"]); // recommendations lead
  assert.ok(!ids(out).includes("anime:1")); // never the title itself
  assert.equal(new Set(ids(out)).size, out.length);
  const extras = out.filter((x) => !recs.includes(x));
  assert.deepEqual(new Set(extras.map((x) => x.segment)), new Set(["anime", "manga", "movie"])); // none for novels (empty) or TV (no shared genre)
  assert.ok(extras.every((x) => x.genres.some((g) => source.genres.includes(g))));
  assert.equal(extras.filter((x) => x.segment === "movie").length, 2); // two per kind, the closest matches
  assert.ok(extras.find((x) => x.id === 401) && !extras.find((x) => x.id === 403)); // both genres beat one
  assert.equal(out[3].id, 200); // the first extra lands after three recommendations
});

test("like mix with no genres to match, no recommendations, or no pools still gives something sensible", () => {
  const recs = [item(5), item(6), item(5)];
  assert.deepEqual(ids(likeMix(item(1), recs, { movie: [item(1, "movie", { genres: ["Drama"] })] })), ["anime:5", "anime:6"]); // source has no genres
  const source = item(1, "movie", { genres: ["Drama"] });
  assert.deepEqual(ids(likeMix(source, [], { tv: [item(9, "tv", { genres: ["Drama"] })] })), ["tv:9"]); // extras alone
  assert.deepEqual(likeMix(source, null, undefined), []);
  assert.deepEqual(likeMix(null, [item(2)]).map((x) => x.id), [2]);
});

test("billboard: only titles that are out and have a banner, never manga or novels, the same title for the same seed", () => {
  const pools = {
    trA: [item(1, "anime", { banner: "b1" }), item(2, "anime"), item(3, "anime", { banner: "b3", unreleased: true })],
    trMv: [item(10, "movie", { banner: "m10" })],
    trTv: [item(20, "tv", { banner: "t20" })],
    popM: [item(30, "manga", { banner: "x" })],
  };
  const all = new Set(["anime:1", "movie:10", "tv:20"]);
  for (let seed = 0; seed < 12; seed++) assert.ok(all.has(ids([billboardPick(pools, seed)])[0]), `seed ${seed}`);
  assert.equal(billboardPick(pools, 7), billboardPick(pools, 7));
  assert.equal(new Set([0, 1, 2].map((s) => billboardPick(pools, s).segment)).size, 3); // movies and series get a turn
  assert.equal(billboardPick(pools, 1e9 + 7).id, billboardPick(pools, 1e9 + 7).id);
});

test("billboard: nothing to show is null (so the screen falls back), and your library is left out when asked", () => {
  assert.equal(billboardPick(null, 1), null);
  assert.equal(billboardPick({ trA: [item(1)] }, 1), null); // no banner
  assert.equal(billboardPick({}, 1), null);
  const pools = { trA: [item(1, "anime", { banner: "b" }), item(2, "anime", { banner: "b" })] };
  assert.equal(billboardPick(pools, 0, new Set(["anime:1"])).id, 2);
  assert.equal(billboardPick(pools, 5, new Set(["anime:1", "anime:2"])), null);
});

// "Want to sign in?" while using the app without an account: at the 1st verdict, then at every 30 (30, 60, 90...).
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { memoryStorage } from "./helpers.js";
import { openDb } from "../../server/src/db.js";
import { createApp } from "../../server/src/app.js";

const mem = memoryStorage();
const c = await import("../api/community.js");
const s = await import("../backend/store.js");

let server, url;
before(async () => {
  server = createServer(createApp({ db: openDb(":memory:"), secret: "t" }));
  await new Promise((r) => server.listen(0, r));
  url = `http://localhost:${server.address().port}`;
});
after(() => server.close());

const show = (id) => ({ id, segment: "anime", title: `Show ${id}`, episodes: 12, finished: true });
let next = 1;
// n more verdicts, each on its own finished title
async function giveVerdicts(n) {
  for (let i = 0; i < n; i++, next++) {
    await s.setStatus(null, "anime", show(next), "completed");
    await s.addReview(null, "anime", next, { verdict: "peak", moods: [], comment: "" });
  }
}

test("the milestones: 1, then every 30", () => {
  const at = [0, 1, 2, 29, 30, 31, 59, 60, 61, 89, 90, 119, 120, 301].map(c.askMilestone);
  assert.deepEqual(at, [0, 1, 1, 1, 30, 30, 30, 60, 60, 60, 90, 90, 120, 300]);
});

test("no server: nothing to sign in to, so nobody is asked", async () => {
  await giveVerdicts(1);
  assert.equal(await c.nextSignInAsk(), null);
});

test("with a server: asked at the first verdict, once, and not again until 30", async () => {
  c.configureCommunity({ baseUrl: url });
  assert.deepEqual(await c.nextSignInAsk(), { milestone: 1, count: 1 });
  await c.markSignInAsked(1);
  assert.equal(await c.nextSignInAsk(), null);          // answered (or dismissed): not again
  await giveVerdicts(28);                                // 29 verdicts
  assert.equal(await c.nextSignInAsk(), null);
  await giveVerdicts(1);                                 // the 30th
  assert.deepEqual(await c.nextSignInAsk(), { milestone: 30, count: 30 });
  await c.markSignInAsked(30);
  assert.equal(await c.nextSignInAsk(), null);
});

test("then 60, 90...; a verdict count that jumps past one asks once, at the latest", async () => {
  await giveVerdicts(30);                                // 60
  assert.deepEqual(await c.nextSignInAsk(), { milestone: 60, count: 60 });
  await c.markSignInAsked(60);
  await giveVerdicts(31);                                // 91: skipped over 90? no, past it
  assert.deepEqual(await c.nextSignInAsk(), { milestone: 90, count: 91 });
  await c.markSignInAsked(90);
  assert.equal(await c.nextSignInAsk(), null);
  assert.equal(mem["voidpop:signin-asked:v1"], "90");    // remembered, so a restart doesn't ask again
});

test("movie and TV verdicts count too", async () => {
  const film = (id) => ({ id, segment: "movie", title: `Film ${id}`, genres: [] });
  const give = async (i) => { await s.setCinemaStatus(film(`f${i}`), "completed"); await s.saveCinemaReview(film(`f${i}`), { verdict: "peak", moods: [], comment: "" }); };
  for (let i = 0; i < 28; i++) await give(i);            // 91 + 28 = 119: still only the 90 milestone, already asked
  assert.equal(await c.nextSignInAsk(), null);
  await give(28);                                        // the 120th verdict is a film
  assert.deepEqual(await c.nextSignInAsk(), { milestone: 120, count: 120 });
  await c.markSignInAsked(120);
});

test("signed in: never asked; signed out again: asked only at the next milestone, not for ones already passed", async () => {
  await c.register({ email: "n@x.com", username: "nudged", password: "password123" });
  await giveVerdicts(30);                                // 150, but signed in
  assert.equal(await c.nextSignInAsk(), null);
  await c.logout();                                      // a guest again
  assert.deepEqual(await c.nextSignInAsk(), { milestone: 150, count: 150 }); // 150 was reached while signed in and never asked
  await c.markSignInAsked(150);
  assert.equal(await c.nextSignInAsk(), null);
  await giveVerdicts(29);
  assert.equal(await c.nextSignInAsk(), null);           // 179
  await giveVerdicts(1);
  assert.deepEqual(await c.nextSignInAsk(), { milestone: 180, count: 180 });
});

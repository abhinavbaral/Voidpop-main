// The real client against the real server (in memory). If one changes, this notices.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { memoryStorage } from "./helpers.js";
import { openDb } from "../../server/src/db.js";
import { createApp } from "../../server/src/app.js";

memoryStorage();
const c = await import("../api/community.js");
const s = await import("../backend/store.js");

let server;
before(async () => {
  server = createServer(createApp({ db: openDb(":memory:"), secret: "t", trustProxy: false, now: () => Date.now() }));
  await new Promise((r) => server.listen(0, r));
  c.configureCommunity({ baseUrl: `http://localhost:${server.address().port}/` });
});
after(() => server.close());

test("off by default; on once an address is set", () => {
  assert.equal(c.hasCommunity(), true);
  assert.equal(c.currentUser(), null);
});

test("sign up, comment, reply, like, verdict, sign out, sign back in", async () => {
  await c.loadAccount();
  const seen = [];
  const off = c.onAccountChange((u) => seen.push(u?.username ?? null));
  const me = await c.register({ email: "a@b.co", username: "abhi", password: "password123" });
  assert.equal(me.username, "abhi");
  assert.equal(c.currentUser().username, "abhi");

  const top = await c.postComment("movie", "demo-1", "Stone-carved frames.");
  const reply = await c.postComment("movie", "demo-1", "Agree.", top.id);
  assert.equal(reply.parentId, top.id);
  await c.setCommentLike(top.id, true);
  let page = await c.fetchComments("movie", "demo-1");
  assert.deepEqual([page.comments.length, page.comments[0].likes, page.comments[0].liked, page.comments[0].replies.length], [1, 1, true, 1]);
  await c.setCommentLike(top.id, false);
  await c.editComment(top.id, "Edited");
  await c.deleteComment(reply.id);

  assert.equal(await c.pushVerdict("movie", "demo-1", { verdict: "peak", status: "watched", moods: [], title: "Dune" }), true);
  assert.equal((await c.fetchTitleVerdicts("movie", "demo-1")).counts.peak, 1);
  assert.equal(await c.dropVerdict("movie", "demo-1"), true);

  await c.logout();
  assert.equal(c.currentUser(), null);
  assert.equal(await c.pushVerdict("movie", "demo-1", { verdict: "peak", status: "watched" }), false); // signed out: quietly nothing
  await assert.rejects(() => c.postComment("movie", "demo-1", "hi"), (e) => e.status === 401);
  await c.login({ identifier: "abhi", password: "password123" });
  assert.equal(c.currentUser().username, "abhi");
  await assert.rejects(() => c.login({ identifier: "abhi", password: "wrong-wrong" }), (e) => e.status === 401 && c.currentUser() !== null); // a failed login doesn't sign you out
  off();
  assert.deepEqual(seen, ["abhi", null, "abhi"]);
});

test("backup: push this device, a second device pulls it, a stale push is refused", async () => {
  await s.setCinemaStatus({ id: "demo-5", segment: "movie", title: "Spider-Verse", genres: [] }, "plan");
  assert.equal(await c.pushBackup(), 1);
  await s.clearData();
  assert.equal((await s.getCinemaShelf()).length, 0);
  assert.equal(await c.pullBackup(), true);
  assert.equal((await s.getCinemaShelf()).length, 1);

  // "another device" saved in between
  const { writeKey } = await import("../backend/storage.js");
  await writeKey("voidpop:sync-version:v1", "0");                  // this device thinks it's at version 0
  await assert.rejects(() => c.pushBackup(), (e) => e.status === 409 && e.extra.version === 1);
});

test("a deleted account signs this device out", async () => {
  await c.deleteAccount();
  assert.equal(c.currentUser(), null);
  await assert.rejects(() => c.login({ identifier: "abhi", password: "password123" }), (e) => e.status === 401);
});

test("unreachable server → a friendly error, not a crash", async () => {
  c.configureCommunity({ baseUrl: "http://localhost:1" });
  await assert.rejects(() => c.fetchTitleVerdicts("tv", "1"), (e) => e.status === 0 && /reach/.test(e.message));
});

test("syncCinemaVerdict: shares the verdict with the shelf status, withdraws it when gone", async () => {
  c.configureCommunity({ baseUrl: `http://localhost:${server.address().port}` });
  await c.register({ email: "sync@b.co", username: "syncfan", password: "password123" });
  const item = { id: "demo-7", segment: "tv", title: "Arcane", genres: [] };
  await s.saveCinemaReview(item, { verdict: "peak", moods: [], comment: "" });
  assert.equal(await c.syncCinemaVerdict(item, await s.getCinemaEntry("tv", "demo-7")), true);
  assert.equal((await c.fetchTitleVerdicts("tv", "demo-7")).total, 1);            // Watched counts
  await s.setCinemaStatus(item, "plan");
  await c.syncCinemaVerdict(item, await s.getCinemaEntry("tv", "demo-7"));
  assert.equal((await c.fetchTitleVerdicts("tv", "demo-7")).total, 0);            // back on the Watchlist: stops counting
  await s.setCinemaStatus(item, null);
  await c.syncCinemaVerdict(item, null);
  assert.equal((await c.fetchTitleVerdicts("tv", "demo-7")).mine, undefined);     // removed
});

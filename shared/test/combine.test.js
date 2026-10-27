// A guest who has been using the app for a while, then signs in: nothing on the phone is lost, nothing is
// replaced behind their back, and what they already had reaches their account and the community.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { memoryStorage } from "./helpers.js";
import { openDb } from "../../server/src/db.js";
import { createApp } from "../../server/src/app.js";

const mem = memoryStorage();
const c = await import("../api/community.js");
const s = await import("../backend/store.js");

let server;
before(async () => {
  server = createServer(createApp({ db: openDb(":memory:"), secret: "t", now: () => Date.now() }));
  await new Promise((r) => server.listen(0, r));
  c.configureCommunity({ baseUrl: `http://localhost:${server.address().port}` });
});
after(() => server.close());

const show = (id) => ({ id, segment: "anime", title: `Show ${id}`, image: "https://img.example/a.jpg", episodes: 12, finished: true });
const film = (id) => ({ id, segment: "movie", title: `Film ${id}`, genres: [] });
const titles = async () => Object.keys(await s.getLibraryAll()).sort();

// a guest with a real library: two finished anime with verdicts, one on the watchlist, one film with a verdict
async function guestLibrary() {
  await s.setStatus(null, "anime", show(1), "completed");
  await s.addReview(null, "anime", 1, { verdict: "peak", moods: [], comment: "" });
  await s.setStatus(null, "anime", show(2), "dropped");
  await s.addReview(null, "anime", 2, { verdict: "voidit", moods: [], comment: "" });
  await s.setStatus(null, "anime", show(3), "plan");
  await s.setCinemaStatus(film("m1"), "completed");
  await s.saveCinemaReview(film("m1"), { verdict: "divein", moods: [], comment: "" });
}

test("signing in does not touch the guest's library; it just isn't uploaded yet", async () => {
  await c.chooseGuest();
  await guestLibrary();
  const before = await titles();
  assert.deepEqual(before, ["anime:1", "anime:2", "anime:3", "movie:m1"]);
  assert.equal(await c.localTitleCount(), 4);

  await c.register({ email: "guest@x.com", username: "was_guest", password: "password123" });
  assert.deepEqual(await titles(), before);                       // all still here
  assert.equal((await s.getMyReview(null, "anime", 1)).verdict, "peak");
  assert.equal(await c.pullBackup(), false);                      // ...but the account has no backup of it
  assert.equal((await c.fetchTitleVerdicts("anime", "1")).total, 0); // and nobody has counted their verdicts
});

test("combine: uploads the library and shares the verdicts that count (not the watchlist)", async () => {
  const r = await c.combineWithAccount();
  assert.deepEqual([r.fromAccount, r.verdicts], [0, 3]);          // two anime + the film; "plan" doesn't count
  assert.equal((await c.fetchTitleVerdicts("anime", "1")).counts.peak, 1);
  assert.equal((await c.fetchTitleVerdicts("anime", "2")).counts.voidit, 1);
  assert.equal((await c.fetchTitleVerdicts("movie", "m1")).counts.divein, 1);
  assert.equal((await c.fetchTitleVerdicts("anime", "3")).total, 0);
  await s.clearData();                                            // a new phone: restore brings it all back
  assert.equal(await c.pullBackup(), true);
  assert.equal((await titles()).length, 4);
});

test("a second phone with its own guest library: Back up is refused, Combine keeps both", async () => {
  await c.logout();                                               // phone B starts as a guest, with different things
  await s.clearData();
  await s.setStatus(null, "anime", show(10), "completed");
  await s.addReview(null, "anime", 10, { verdict: "divein", moods: [], comment: "" });
  await s.setCinemaStatus(film("m2"), "plan");
  await c.login({ identifier: "was_guest", password: "password123" });
  assert.deepEqual(await titles(), ["anime:10", "movie:m2"]);     // still there after signing in

  await assert.rejects(() => c.pushBackup(), (e) => e.status === 409); // overwriting the account is refused

  const r = await c.combineWithAccount();
  assert.equal(r.fromAccount, 4);                                 // the account's four came in
  assert.deepEqual(await titles(), ["anime:1", "anime:10", "anime:2", "anime:3", "movie:m1", "movie:m2"]); // both phones' titles
  assert.equal((await c.fetchTitleVerdicts("anime", "10")).counts.divein, 1);
  assert.equal((await c.fetchTitleVerdicts("anime", "1")).total, 1); // not counted twice

  await s.clearData();                                            // phone C restores the account: it now holds everything
  assert.equal(await c.pullBackup(), true);
  assert.equal((await titles()).length, 6);
});

test("combining again changes nothing (safe to tap twice)", async () => {
  const before = await titles();
  const r = await c.combineWithAccount();
  assert.deepEqual([await titles(), r.fromAccount], [before, 0]);
});

/* ---------- the merge rules ---------- */

const backup = (over = {}) => JSON.stringify({ app: "voidpop", version: 1, library: {}, reviews: {}, excited: {}, cinema: {}, notes: {}, log: [], categories: [], meta: {}, settings: {}, ...over });
const entry = (id, status, updatedAt) => ({ status, progress: 0, item: show(id), updatedAt, addedAt: updatedAt });

test("merge: the more recently changed copy of a title wins; the rest of both sides is kept", async () => {
  await s.clearData();
  await s.setStatus(null, "anime", show(1), "watching"); // changed just now on this phone
  const old = new Date(Date.now() - 5 * 864e5).toISOString(), recent = new Date(Date.now() + 60000).toISOString();
  const r = await s.mergeData(backup({
    library: { "anime:1": entry(1, "completed", old), "anime:2": entry(2, "plan", old), "anime:4": entry(4, "completed", recent) },
    reviews: { "anime:2": { segment: "anime", titleId: 2, verdict: "peak", moods: [], date: old } },
    notes: { "anime:2": { text: "from the account", at: old } },
    log: [[1000, "anime:2", 0, "status:plan"]],
    settings: { name: "Somebody Else", clock24: true }, meta: { onboarded: false, tip: "x" },
  }));
  assert.equal(r.added, 2);                                                  // anime:2 and anime:4 were only in the backup
  const lib = await s.getLibrary();
  assert.equal(lib["anime:1"].status, "watching");                           // this phone's was newer: kept
  assert.equal(lib["anime:2"].status, "plan");
  assert.equal((await s.getMyReview(null, "anime", 2)).verdict, "peak");
  assert.equal((await s.getSettings?.())?.name ?? "", "");                    // settings are this phone's, not the backup's
  assert.ok((await s.getLog()).some((e) => e[1] === "anime:2"));              // histories joined

  await s.mergeData(backup({ library: { "anime:1": entry(1, "completed", recent) } }));
  assert.equal((await s.getLibrary())["anime:1"].status, "completed");        // the backup's was newer: it wins
});

test("merge: an old-format backup is accepted, a foreign file is refused and changes nothing", async () => {
  const before = await titles();
  assert.deepEqual(await s.mergeData("not json"), { error: "That isn't a VoidPop backup." });
  assert.deepEqual(await s.mergeData(JSON.stringify({ app: "other", library: {} })), { error: "That isn't a VoidPop backup." });
  assert.deepEqual(await titles(), before);
  assert.equal((await s.mergeData(JSON.stringify({ app: "voidation", library: { "anime:77": entry(77, "completed", new Date().toISOString()) } }))).added, 1);
});

test("every verdict goes, however many: 250 in three batches, whatever their status", async () => {
  await c.logout();
  await s.clearData();
  await c.register({ email: "many@x.com", username: "many_verdicts", password: "password123" });
  const status = (i) => ["completed", "dropped", "rewatching", "watching", "onhold", "plan"][i % 6];
  for (let i = 1; i <= 250; i++) {
    await s.setStatus(null, "anime", show(1000 + i), status(i));
    await s.addReview(null, "anime", 1000 + i, { verdict: "peak", moods: [], comment: "" });
  }
  assert.equal(await c.shareAllVerdicts(), 250);                                  // not 100: all of them
  assert.equal((await c.fetchTitleVerdicts("anime", "1250")).mine?.verdict, "peak"); // the last one arrived too
  const counted = (i) => ["completed", "dropped", "rewatching"].includes(status(i));
  let inSplit = 0;
  for (const i of [1, 2, 3, 4, 5, 6, 247, 248, 249, 250]) inSplit += (await c.fetchTitleVerdicts("anime", String(1000 + i))).total;
  assert.equal(inSplit, [1, 2, 3, 4, 5, 6, 247, 248, 249, 250].filter(counted).length); // finished/dropped/rewatching count; the rest are kept, not counted
});

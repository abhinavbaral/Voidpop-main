import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { openDb } from "../src/db.js";
import { createApp } from "../src/app.js";
import { makeTokens, hashPassword, checkPassword } from "../src/auth.js";

let server, base, clock = Date.now(), ipN = 0;
const SECRET = "test-secret";

before(async () => {
  const app = createApp({ db: openDb(":memory:"), secret: SECRET, trustProxy: true, now: () => clock });
  server = createServer(app);
  await new Promise((r) => server.listen(0, r));
  base = `http://localhost:${server.address().port}`;
});
after(() => server.close());

// each call gets its own "IP" so the rate limiter doesn't trip over unrelated tests
async function call(method, path, { token, body, ip } = {}) {
  const res = await fetch(base + path, {
    method,
    headers: { "Content-Type": "application/json", "X-Forwarded-For": ip || `10.0.0.${++ipN % 250}`, ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
  });
  return { status: res.status, json: await res.json().catch(() => null) };
}
const signUp = async (name) => (await call("POST", "/api/auth/register", { body: { email: `${name}@x.com`, username: name, password: "password123" } })).json;

/* ---------- auth ---------- */

test("passwords and tokens: hashed, forged and expired ones are refused", () => {
  const h = hashPassword("hunter2hunter2");
  assert.ok(checkPassword("hunter2hunter2", h) && !checkPassword("hunter2hunter3", h));
  assert.ok(!h.includes("hunter2"));
  const t = makeTokens("s");
  const tok = t.issue(7, 1000);
  assert.equal(t.verify(tok, 2000), 7);
  assert.equal(t.verify(tok, 1000 + 31 * 86400000), null);               // expired
  assert.equal(makeTokens("other").verify(tok, 2000), null);              // wrong secret
  assert.equal(t.verify(tok.slice(0, -2) + "xx", 2000), null);            // tampered
  assert.equal(t.verify("garbage", 2000), null);
});

test("register, login (by email or username), /me", async () => {
  const reg = await call("POST", "/api/auth/register", { body: { email: "Mira@Example.com", username: "mira_k", password: "password123" } });
  assert.equal(reg.status, 201);
  assert.equal(reg.json.user.username, "mira_k");
  assert.ok(!JSON.stringify(reg.json).includes("password"));

  assert.equal((await call("POST", "/api/auth/register", { body: { email: "mira@example.com", username: "other", password: "password123" } })).status, 409); // email, any case
  assert.equal((await call("POST", "/api/auth/register", { body: { email: "o@example.com", username: "MIRA_K", password: "password123" } })).status, 409); // username, any case
  for (const body of [{ email: "nope", username: "abc", password: "password123" }, { email: "a@b.co", username: "a b", password: "password123" }, { email: "a@b.co", username: "abc", password: "short" }]) {
    assert.equal((await call("POST", "/api/auth/register", { body })).status, 400);
  }

  const byEmail = await call("POST", "/api/auth/login", { body: { identifier: "mira@example.com", password: "password123" } });
  const byName = await call("POST", "/api/auth/login", { body: { identifier: "mira_k", password: "password123" } });
  assert.equal(byEmail.status, 200); assert.equal(byName.status, 200);
  const wrongPw = await call("POST", "/api/auth/login", { body: { identifier: "mira_k", password: "nope-nope-nope" } });
  const noUser = await call("POST", "/api/auth/login", { body: { identifier: "ghost", password: "password123" } });
  assert.equal(wrongPw.status, 401);
  assert.deepEqual(wrongPw.json, noUser.json);                            // can't tell which part was wrong

  assert.equal((await call("GET", "/api/me", { token: byName.json.token })).json.user.email, "mira@example.com");
  assert.equal((await call("GET", "/api/me")).status, 401);
  assert.equal((await call("GET", "/api/me", { token: "bad.token" })).status, 401);
});

test("login and register are rate limited", async () => {
  const ip = "9.9.9.9";
  let last;
  for (let i = 0; i < 11; i++) last = await call("POST", "/api/auth/login", { ip, body: { identifier: "x", password: "y" } });
  assert.equal(last.status, 429);
  clock += 61000;                                                          // a minute later it's fine again
  assert.equal((await call("POST", "/api/auth/login", { ip, body: { identifier: "x", password: "y" } })).status, 401);
});

/* ---------- verdicts ---------- */

test("community counts: only finished or dropped people count; one verdict per person", async () => {
  const names = ["vote1", "vote2", "vote3", "vote4", "vote5"];
  const users = [];
  for (const n of names) users.push(await signUp(n));
  const put = (u, verdict, status) => call("PUT", "/api/verdicts/tv/321", { token: u.token, body: { verdict, status, moods: ["Made me feel alive."], title: "Show" } });
  assert.equal((await put(users[0], "peak", "completed")).status, 200);
  await put(users[1], "peak", "watched");
  await put(users[2], "voidit", "dropped");
  await put(users[3], "peak", "watching");                                  // still on episode 2: doesn't count
  await put(users[4], "divein", "plan");                                    // hasn't seen it: doesn't count
  await put(users[0], "divein", "completed");                               // changed their mind: still one vote

  const pub = await call("GET", "/api/titles/tv/321/verdicts");
  assert.deepEqual(pub.json, { total: 3, counts: { peak: 1, divein: 1, onetime: 0, voidit: 1 } });
  assert.equal((await call("GET", "/api/titles/tv/321/verdicts", { token: users[3].token })).json.mine.verdict, "peak");

  await call("DELETE", "/api/verdicts/tv/321", { token: users[2].token });
  assert.equal((await call("GET", "/api/titles/tv/321/verdicts")).json.total, 2);

  const badOnes = [["PUT", "/api/verdicts/book/1", { verdict: "peak", status: "completed" }], ["PUT", "/api/verdicts/tv/1", { verdict: "great", status: "completed" }],
    ["PUT", "/api/verdicts/tv/1", { verdict: "peak", status: "bored" }], ["PUT", "/api/verdicts/tv/a%20b", { verdict: "peak", status: "completed" }]];
  for (const [m, p, b] of badOnes) assert.equal((await call(m, p, { token: users[0].token, body: b })).status, 400);
  assert.equal((await call("PUT", "/api/verdicts/tv/1", { body: { verdict: "peak", status: "completed" } })).status, 401);
});

test("rankings: titles with enough counted verdicts and their split; novels accepted; watching/plan not counted", async () => {
  const people = [];
  for (let i = 0; i < 4; i++) people.push(await signUp(`rank_${i}`));
  const put = (u, seg, id, verdict, status, title) => call("PUT", `/api/verdicts/${seg}/${id}`, { token: u.token, body: { verdict, status, title, image: "http://img/" + id } });
  for (const [i, u] of people.entries()) await put(u, "novel", "n1", i === 3 ? "divein" : "peak", "completed", "Novel One");
  await put(people[0], "movie", "m1", "peak", "completed", "Film One");
  await put(people[1], "movie", "m1", "peak", "watching", "Film One"); // still watching: not counted
  const all = (await call("GET", "/api/rankings?min=1")).json.titles;
  const novel = all.find((t) => t.segment === "novel" && t.id === "n1");
  assert.deepEqual(novel.counts, { peak: 3, divein: 1, onetime: 0, voidit: 0 });
  assert.equal(novel.total, 4); assert.equal(novel.title, "Novel One");
  assert.equal(all.find((t) => t.id === "m1").total, 1);
  const strict = (await call("GET", "/api/rankings?min=3")).json.titles;
  assert.ok(strict.some((t) => t.id === "n1") && !strict.some((t) => t.id === "m1"));
  assert.ok((await call("GET", "/api/rankings")).json.titles.every((t) => t.total >= 20)); // default minimum
});

/* ---------- comments ---------- */

test("comments: post, reply, like, edit, delete, rules", async () => {
  const a = await signUp("cmt_a"), b = await signUp("cmt_b");
  await call("PUT", "/api/verdicts/movie/55", { token: a.token, body: { verdict: "peak", status: "watched" } });

  const c1 = (await call("POST", "/api/titles/movie/55/comments", { token: a.token, body: { body: "  Quiet and devastating.  " } })).json.comment;
  assert.equal(c1.body, "Quiet and devastating.");
  const reply = (await call("POST", "/api/titles/movie/55/comments", { token: b.token, body: { body: "Agreed!", parentId: c1.id } })).json.comment;
  assert.equal(reply.parentId, c1.id);
  assert.equal((await call("POST", "/api/titles/movie/55/comments", { token: b.token, body: { body: "deeper", parentId: reply.id } })).status, 400);   // one level of replies
  assert.equal((await call("POST", "/api/titles/movie/99/comments", { token: b.token, body: { body: "wrong title", parentId: c1.id } })).status, 400);
  assert.equal((await call("POST", "/api/titles/movie/55/comments", { token: b.token, body: { body: "   " } })).status, 400);
  assert.equal((await call("POST", "/api/titles/movie/55/comments", { token: b.token, body: { body: "x".repeat(1001) } })).status, 400);
  assert.equal((await call("POST", "/api/titles/movie/55/comments", { body: { body: "hi" } })).status, 401);

  assert.equal((await call("PUT", `/api/comments/${c1.id}/like`, { token: b.token })).status, 200);
  await call("PUT", `/api/comments/${c1.id}/like`, { token: b.token });                  // twice = once
  let list = (await call("GET", "/api/titles/movie/55/comments", { token: b.token })).json;
  assert.equal(list.comments.length, 1);
  assert.deepEqual([list.comments[0].likes, list.comments[0].liked, list.comments[0].mine, list.comments[0].verdict, list.comments[0].author], [1, true, false, "peak", "cmt_a"]);
  assert.equal(list.comments[0].replies[0].body, "Agreed!");
  assert.equal((await call("GET", "/api/titles/movie/55/comments")).json.comments[0].liked, false);   // signed out: no "liked"

  await call("DELETE", `/api/comments/${c1.id}/like`, { token: b.token });
  assert.equal((await call("GET", "/api/titles/movie/55/comments")).json.comments[0].likes, 0);

  assert.equal((await call("PATCH", `/api/comments/${c1.id}`, { token: b.token, body: { body: "mine now" } })).status, 403);
  assert.equal((await call("DELETE", `/api/comments/${c1.id}`, { token: b.token })).status, 403);
  const edited = (await call("PATCH", `/api/comments/${c1.id}`, { token: a.token, body: { body: "Edited." } })).json.comment;
  assert.ok(edited.editedAt);

  // deleting a comment that has replies keeps a blank tombstone for them; the text is gone
  await call("DELETE", `/api/comments/${c1.id}`, { token: a.token });
  list = (await call("GET", "/api/titles/movie/55/comments")).json;
  assert.deepEqual([list.comments[0].deleted, list.comments[0].body, list.comments[0].replies.length], [true, "", 1]);
  await call("DELETE", `/api/comments/${reply.id}`, { token: b.token });
  assert.equal((await call("GET", "/api/titles/movie/55/comments")).json.comments.length, 0);   // nothing left to show
  assert.equal((await call("DELETE", `/api/comments/${reply.id}`, { token: b.token })).status, 404);
});

test("comments: newest first, 20 per page, then 'nextBefore'", async () => {
  const u = await signUp("pager");
  for (let i = 1; i <= 25; i++) await call("POST", "/api/titles/anime/1/comments", { token: u.token, body: { body: `c${i}` } });
  const p1 = (await call("GET", "/api/titles/anime/1/comments")).json;
  assert.equal(p1.comments.length, 20);
  assert.equal(p1.comments[0].body, "c25");
  const p2 = (await call("GET", `/api/titles/anime/1/comments?before=${p1.nextBefore}`)).json;
  assert.deepEqual([p2.comments.length, p2.comments.at(-1).body, p2.nextBefore], [5, "c1", null]);
});

/* ---------- sync, deleting an account, odd requests ---------- */

test("cloud sync: save, read, and a second device can't silently overwrite", async () => {
  const u = await signUp("syncer");
  assert.deepEqual((await call("GET", "/api/sync", { token: u.token })).json, { data: null, version: 0 });
  const first = await call("PUT", "/api/sync", { token: u.token, body: { data: JSON.stringify({ library: { a: 1 } }), baseVersion: 0 } });
  assert.equal(first.json.version, 1);
  const stale = await call("PUT", "/api/sync", { token: u.token, body: { data: "{}", baseVersion: 0 } });
  assert.deepEqual([stale.status, stale.json.version], [409, 1]);
  assert.equal((await call("PUT", "/api/sync", { token: u.token, body: { data: "{}", baseVersion: 1 } })).json.version, 2);
  assert.equal((await call("PUT", "/api/sync", { token: u.token, body: { data: "not json", baseVersion: 2 } })).status, 400);
  assert.equal((await call("GET", "/api/sync", { token: u.token })).json.data, "{}");
  const other = await signUp("syncer2");
  assert.equal((await call("GET", "/api/sync", { token: other.token })).json.data, null);   // nobody else's
});

test("deleting an account removes its verdicts, comments and backup", async () => {
  const u = await signUp("leaver");
  await call("PUT", "/api/verdicts/tv/777", { token: u.token, body: { verdict: "peak", status: "completed" } });
  await call("POST", "/api/titles/tv/777/comments", { token: u.token, body: { body: "bye" } });
  await call("PUT", "/api/sync", { token: u.token, body: { data: "{}", baseVersion: 0 } });
  assert.equal((await call("DELETE", "/api/me", { token: u.token })).status, 200);
  assert.equal((await call("GET", "/api/titles/tv/777/verdicts")).json.total, 0);
  assert.equal((await call("GET", "/api/titles/tv/777/comments")).json.comments.length, 0);
  assert.equal((await call("GET", "/api/me", { token: u.token })).status, 401);          // token for a deleted user is useless
});

test("odd requests get tidy errors", async () => {
  assert.equal((await call("GET", "/api/health")).json.ok, true);
  assert.equal((await call("GET", "/api/nothing")).status, 404);
  assert.equal((await call("POST", "/api/auth/login", { body: "{not json" })).status, 400);
  assert.equal((await call("POST", "/api/auth/login", { body: "[1,2]" })).status, 400);              // an array isn't an object
  const res = await fetch(base + "/api/health", { method: "OPTIONS", headers: { Origin: "https://x.dev" } });
  assert.equal(res.status, 204);
  assert.equal(res.headers.get("access-control-allow-origin"), "*");
});

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { openDb } from "../src/db.js";
import { createApp } from "../src/app.js";
import { makeTokens, hashPassword, checkPassword } from "../src/auth.js";
import { makeVerifier, OidcError, GOOGLE } from "../src/oidc.js";
import { makeIdp } from "./idp.js";
import { generateKeyPairSync } from "node:crypto";

let server, base, clock = Date.now(), ipN = 0;
const SECRET = "test-secret";
const idp = makeIdp(); // a fake Google/Apple: signs real tokens, serves its public key

before(async () => {
  const app = createApp({ db: openDb(":memory:"), secret: SECRET, trustProxy: true, now: () => clock, google: ["g-web"], apple: ["com.voidation.app"], fetchJson: idp.fetchJson });
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

/* ---------- sign in with Google / Apple ---------- */

const sec = () => Math.floor(clock / 1000);
const gClaims = (over = {}) => ({ iss: "https://accounts.google.com", aud: "g-web", sub: "g-1001", email: "ria@gmail.com", email_verified: true, name: "Ria Sharma", iat: sec(), exp: sec() + 3600, ...over });
const aClaims = (over = {}) => ({ iss: "https://appleid.apple.com", aud: "com.voidation.app", sub: "a-2001", email: "ria@privaterelay.appleid.com", email_verified: "true", iat: sec(), exp: sec() + 3600, ...over });
const viaGoogle = (claims, { as, jwt, body } = {}) => call("POST", "/api/auth/google", { token: as, body: { idToken: idp.jwt(claims, jwt), ...body } });
const viaApple = (claims, { as, jwt, name } = {}) => call("POST", "/api/auth/apple", { token: as, body: { identityToken: idp.jwt(claims, jwt), ...(name ? { name } : {}) } });

test("which sign-ins the server has set up", async () => {
  assert.deepEqual((await call("GET", "/api/auth/providers")).json, { google: true, apple: true });
  const off = createServer(createApp({ db: openDb(":memory:"), secret: "x", now: () => clock }));
  await new Promise((r) => off.listen(0, r));
  const url = `http://localhost:${off.address().port}`;
  try {
    assert.deepEqual(await (await fetch(`${url}/api/auth/providers`)).json(), { google: false, apple: false });
    const r = await fetch(`${url}/api/auth/google`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idToken: idp.jwt(gClaims()) }) });
    assert.equal(r.status, 503); // not set up: refused, not "verified" against nothing
  } finally { off.close(); }
});

test("Google: the first sign-in makes an account, the next ones land in it; there is no password to guess", async () => {
  const first = await viaGoogle(gClaims({ sub: "g-new-1" }));
  assert.equal(first.status, 201);
  assert.deepEqual([first.json.isNew, first.json.user.email, first.json.user.providers], [true, "ria@gmail.com", ["google"]]);
  assert.equal(first.json.user.username, "Ria_Sharma"); // from the name Google gave
  assert.ok(!JSON.stringify(first.json).includes("pass"));
  assert.equal((await call("GET", "/api/me", { token: first.json.token })).json.user.id, first.json.user.id); // the token works

  const again = await viaGoogle(gClaims({ sub: "g-new-1", name: "Changed Name" }));
  assert.deepEqual([again.status, again.json.isNew, again.json.user.id], [200, false, first.json.user.id]); // the same person, not a second account
  // an account with no password can't be reached by guessing one, by email or by username
  for (const identifier of ["ria@gmail.com", "Ria_Sharma"]) {
    for (const password of ["!", "", "password123"]) assert.equal((await call("POST", "/api/auth/login", { body: { identifier, password } })).status, 401);
  }
});

test("Google: tokens that are forged, for another app, expired or tampered with are refused", async () => {
  const other = generateKeyPairSync("rsa", { modulusLength: 2048 }).privateKey;
  const good = idp.jwt(gClaims({ sub: "g-forge" }));
  const [h, p] = good.split(".");
  const forgedPayload = idp.b64(gClaims({ sub: "g-forge", email: "victim@gmail.com" }));
  const bad = {
    "another app's token": () => viaGoogle(gClaims({ aud: "someone-elses-app" })),
    "an array of other audiences": () => viaGoogle(gClaims({ aud: ["x", "y"] })),
    "not from Google": () => viaGoogle(gClaims({ iss: "https://evil.example" })),
    "expired": () => viaGoogle(gClaims({ exp: sec() - 3600 })),
    "issued in the future": () => viaGoogle(gClaims({ iat: sec() + 3600 })),
    "no subject": () => viaGoogle(gClaims({ sub: "" })),
    "signed with another key": () => viaGoogle(gClaims(), { jwt: { key: other } }),
    "payload swapped, signature kept": () => call("POST", "/api/auth/google", { body: { idToken: `${h}.${forgedPayload}.${good.split(".")[2]}` } }),
    "alg none": () => call("POST", "/api/auth/google", { body: { idToken: `${idp.b64({ alg: "none", kid: "key-1" })}.${p}.` } }),
    "HS256 with a made-up secret": () => viaGoogle(gClaims(), { jwt: { alg: "HS256", key: null } }),
    "unknown key id": () => viaGoogle(gClaims(), { jwt: { kid: "no-such-key" } }),
    "not a token": () => call("POST", "/api/auth/google", { body: { idToken: "hello.world" } }),
  };
  for (const [what, run] of Object.entries(bad)) assert.equal((await run()).status, 401, what);
  assert.equal((await call("POST", "/api/auth/google", { body: {} })).status, 400); // nothing sent
  assert.equal((await call("POST", "/api/auth/google", { body: { idToken: "x".repeat(9000) } })).status, 400);
  // an Apple token is not a Google token, whatever it says
  assert.equal((await call("POST", "/api/auth/google", { body: { idToken: idp.jwt(aClaims()) } })).status, 401);
});

test("Google: an email that already has a password account is never linked on its own; sign in, then connect", async () => {
  const pw = await signUp("sam_pw"); // sam_pw@x.com, made with a password
  const claims = gClaims({ sub: "g-sam", email: "sam_pw@x.com", name: "Sam" });
  const blocked = await viaGoogle(claims);
  assert.equal(blocked.status, 409);
  assert.match(blocked.json.error, /sign in with your password/i);
  assert.deepEqual((await call("GET", "/api/me", { token: pw.token })).json.user.providers, []); // still nothing connected

  const linked = await viaGoogle(claims, { as: pw.token }); // now signed in: connect it
  assert.deepEqual([linked.status, linked.json.linked, linked.json.user.id, linked.json.user.providers], [200, true, pw.user.id, ["google"]]);
  const afterwards = await viaGoogle(claims); // Google alone now opens that same account
  assert.deepEqual([afterwards.status, afterwards.json.user.id], [200, pw.user.id]);

  const stranger = await signUp("not_sam");
  assert.equal((await viaGoogle(claims, { as: stranger.token })).status, 409); // one Google account, one VoidPop account
});

test("Google: an email Google hasn't verified is not trusted: the account gets no email", async () => {
  await signUp("taken_em"); // taken_em@x.com
  const r = await viaGoogle(gClaims({ sub: "g-unverified", email: "taken_em@x.com", email_verified: false, name: "Quiet One" }));
  assert.equal(r.status, 201); // no clash: that email is not claimed
  assert.equal(r.json.user.email, null);
});

test("Apple: a hidden or missing email is fine, the name comes from the phone, and a relay address counts as an email", async () => {
  const hidden = await viaApple(aClaims({ sub: "a-hidden", email: undefined, email_verified: undefined }), { name: "Kiran Rai" });
  assert.equal(hidden.status, 201);
  assert.deepEqual([hidden.json.user.email, hidden.json.user.username, hidden.json.user.providers], [null, "Kiran_Rai", ["apple"]]);
  assert.equal((await call("GET", "/api/me", { token: hidden.json.token })).json.user.email, null); // the made-up address never leaks
  assert.equal((await viaApple(aClaims({ sub: "a-hidden", email: undefined }))).json.user.id, hidden.json.user.id); // no name this time: same account

  const relay = await viaApple(aClaims({ sub: "a-relay" }));
  assert.deepEqual([relay.json.user.email, relay.json.user.providers], ["ria@privaterelay.appleid.com", ["apple"]]);
  assert.equal((await viaApple(aClaims({ aud: "g-web" }))).status, 401); // a Google client id is not an Apple one
});

test("usernames made for Google/Apple people: from the name, else the email, never taken, changeable", async () => {
  const a = await viaGoogle(gClaims({ sub: "g-d1", email: undefined, name: "Dup Name" }));
  const b = await viaGoogle(gClaims({ sub: "g-d2", email: undefined, name: "Dup Name" }));
  assert.equal(a.json.user.username, "Dup_Name");
  assert.ok(b.json.user.username.startsWith("Dup_Name") && b.json.user.username !== "Dup_Name");
  // a name with nothing usable (another script) falls back to the start of the email, then to a plain default
  assert.equal((await viaGoogle(gClaims({ sub: "g-n1", email: "nepali.user@gmail.com", name: "\u0928\u0947\u092a\u093e\u0932\u0940" }))).json.user.username, "nepali_user");
  assert.ok((await viaGoogle(gClaims({ sub: "g-n2", email: undefined, name: "\u0928\u0947\u092a\u093e\u0932\u0940" }))).json.user.username.startsWith("voidpop"));

  const t = a.json.token;
  assert.equal((await call("PATCH", "/api/me", { token: t, body: { username: "my_own_name" } })).json.user.username, "my_own_name");
  assert.equal((await call("PATCH", "/api/me", { token: t, body: { username: "MY_OWN_NAME" } })).status, 200); // your own name, any case
  assert.equal((await call("PATCH", "/api/me", { token: b.json.token, body: { username: "my_own_name" } })).status, 409); // taken
  assert.equal((await call("PATCH", "/api/me", { token: t, body: { username: "no spaces" } })).status, 400);
  assert.equal((await call("PATCH", "/api/me", { token: t, body: { username: "ab" } })).status, 400);
  assert.equal((await call("PATCH", "/api/me", { body: { username: "whoever" } })).status, 401);
});

test("deleting a Google account removes the link too: signing in with it again starts fresh", async () => {
  const first = await viaGoogle(gClaims({ sub: "g-gone", email: "gone@gmail.com" }));
  assert.equal((await call("DELETE", "/api/me", { token: first.json.token })).status, 200);
  const again = await viaGoogle(gClaims({ sub: "g-gone", email: "gone@gmail.com" }));
  assert.deepEqual([again.status, again.json.isNew], [201, true]);
  assert.notEqual(again.json.user.id, first.json.user.id);
});

/* ---------- checking tokens: the provider's keys ---------- */

test("the provider's keys are kept for a while, an unknown key id re-checks at most once a minute, and an outage is survived", async () => {
  const fake = makeIdp({ kid: "k-a" });
  let t = 1_000_000_000_000;
  const verify = makeVerifier({ fetchJson: fake.fetchJson, now: () => t });
  const rules = { ...GOOGLE, audiences: ["g-web"] };
  const claims = (over = {}) => ({ iss: GOOGLE.issuers[0], aud: "g-web", sub: "s1", iat: Math.floor(t / 1000), exp: Math.floor(t / 1000) + 3600, ...over });

  assert.equal((await verify(fake.jwt(claims()), rules)).sub, "s1");
  assert.equal((await verify(fake.jwt(claims()), rules)).sub, "s1");
  assert.equal(fake.state.calls, 1); // the second one used the kept keys

  // junk tokens with a key id we don't know: one re-check, then none until a minute has passed
  for (let i = 0; i < 5; i++) await assert.rejects(verify(fake.jwt(claims(), { kid: "nope" }), rules), (e) => e instanceof OidcError && e.kind === "invalid");
  assert.ok(fake.state.calls <= 2, `fetched ${fake.state.calls} times`);

  // the provider goes down: tokens signed with keys we already have still work
  t += 2 * 60 * 60 * 1000; // past the hour the keys are kept for
  fake.state.down = true;
  assert.equal((await verify(fake.jwt(claims()), rules)).sub, "s1");

  // ...but with nothing kept and the provider down, we can't tell: "unavailable", not "invalid"
  const cold = makeVerifier({ fetchJson: fake.fetchJson, now: () => t });
  await assert.rejects(cold(fake.jwt(claims()), rules), (e) => e instanceof OidcError && e.kind === "unavailable");
  // a key the provider rotates in is picked up
  fake.state.down = false;
  const rotated = makeIdp({ kid: "k-b" });
  fake.state.keys = [fake.jwk, rotated.jwk];
  assert.equal((await verify(rotated.jwt(claims({ sub: "s2" })), rules)).sub, "s2");
});

test("a deleted account's login token never opens a newer account", async () => {
  const gone = await signUp("soon_gone");
  assert.equal((await call("DELETE", "/api/me", { token: gone.token })).status, 200);
  const next = await signUp("brand_new"); // made right after: it must not inherit the deleted account's id
  assert.notEqual(next.user.id, gone.user.id);
  assert.equal((await call("GET", "/api/me", { token: gone.token })).status, 401);
});

test("bulk verdicts: a guest's existing library is shared in one go; bad items are skipped, repeats don't double count", async () => {
  const u = await signUp("bulker");
  const items = [
    { segment: "anime", id: "bulk-1", verdict: "peak", status: "completed", moods: ["a"], title: "One", image: "https://img.example/1.jpg" },
    { segment: "tv", id: "bulk-2", verdict: "voidit", status: "dropped", title: "Two" },
    { segment: "anime", id: "bulk-3", verdict: "divein", status: "plan" },       // saved, but a Watchlist title doesn't count in the split
    { segment: "nope", id: "bulk-4", verdict: "peak", status: "completed" },     // unknown kind: skipped
    { segment: "anime", id: "bulk-5", verdict: "great", status: "completed" },   // unknown verdict: skipped
    { segment: "anime", id: "bad id!", verdict: "peak", status: "completed" },   // bad id: skipped
    null, "junk",
  ];
  const r = await call("POST", "/api/verdicts/bulk", { token: u.token, body: { items } });
  assert.deepEqual([r.status, r.json.saved, r.json.skipped], [200, 3, 5]);
  assert.equal((await call("GET", "/api/titles/anime/bulk-1/verdicts")).json.counts.peak, 1);
  assert.equal((await call("GET", "/api/titles/tv/bulk-2/verdicts")).json.counts.voidit, 1);
  assert.equal((await call("GET", "/api/titles/anime/bulk-3/verdicts")).json.total, 0);

  await call("POST", "/api/verdicts/bulk", { token: u.token, body: { items } }); // sent again (a retry)
  assert.equal((await call("GET", "/api/titles/anime/bulk-1/verdicts")).json.total, 1); // still one person, one verdict

  assert.equal((await call("POST", "/api/verdicts/bulk", { body: { items } })).status, 401);
  assert.equal((await call("POST", "/api/verdicts/bulk", { token: u.token, body: { items: "x" } })).status, 400);
  const tooMany = Array.from({ length: 101 }, (_, i) => ({ segment: "anime", id: `m${i}`, verdict: "peak", status: "completed" }));
  assert.equal((await call("POST", "/api/verdicts/bulk", { token: u.token, body: { items: tooMany } })).status, 400);
  const full = Array.from({ length: 100 }, (_, i) => ({ segment: "anime", id: `f${i}`, verdict: "peak", status: "completed", title: "T".repeat(300), image: `https://x.example/${"p".repeat(600)}` }));
  assert.equal((await call("POST", "/api/verdicts/bulk", { token: u.token, body: { items: full } })).json.saved, 100); // a full batch fits the body limit
});

test("a verdict is accepted with any status the app has, and a title being rewatched still counts", async () => {
  const u = await signUp("statuser");
  for (const status of ["completed", "dropped", "watched", "rewatching", "watching", "plan", "considering", "onhold", "paused"]) {
    assert.equal((await call("PUT", `/api/verdicts/anime/st-${status}`, { token: u.token, body: { verdict: "peak", status } })).status, 200, status);
  }
  const total = async (status) => (await call("GET", `/api/titles/anime/st-${status}/verdicts`)).json.total;
  assert.deepEqual([await total("completed"), await total("dropped"), await total("rewatching")], [1, 1, 1]); // finished or dropped: counted
  assert.deepEqual([await total("watching"), await total("onhold"), await total("plan"), await total("considering")], [0, 0, 0, 0]); // not yet: kept, not counted
  assert.equal((await call("PUT", "/api/verdicts/anime/st-bad", { token: u.token, body: { verdict: "peak", status: "finished" } })).status, 400);
});

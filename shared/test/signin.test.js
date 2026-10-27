// Guest mode and Google/Apple sign-in, as the app uses them: the real client against the real server (in memory),
// with a fake Google that signs real tokens.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { generateKeyPairSync } from "node:crypto";
import { memoryStorage } from "./helpers.js";
import { openDb } from "../../server/src/db.js";
import { createApp } from "../../server/src/app.js";
import { makeIdp } from "../../server/test/idp.js";

const mem = memoryStorage();
const c = await import("../api/community.js");

const idp = makeIdp();
let clock = Date.now(), server, url;
const sec = () => Math.floor(clock / 1000);
const claims = (over = {}) => ({ iss: "https://accounts.google.com", aud: "g-web", sub: "g-1", email: "ria@gmail.com", email_verified: true, name: "Ria Sharma", iat: sec(), exp: sec() + 3600, ...over });

before(async () => {
  server = createServer(createApp({ db: openDb(":memory:"), secret: "t", now: () => clock, google: ["g-web"], fetchJson: idp.fetchJson }));
  await new Promise((r) => server.listen(0, r));
  url = `http://localhost:${server.address().port}`;
});
after(() => server.close());

test("with no server set up the sign-in screen is never asked for", async () => {
  assert.equal(c.hasCommunity(), false);
  assert.equal(await c.shouldAskSignIn(), false); // the app works exactly as it did, on the phone
  assert.deepEqual(await c.fetchProviders(), { google: false, apple: false });
});

test("with a server and nobody signed in: ask once; \"guest\" is remembered", async () => {
  c.configureCommunity({ baseUrl: url });
  assert.equal(await c.shouldAskSignIn(), true);
  assert.deepEqual(await c.fetchProviders(), { google: true, apple: false });
  await c.chooseGuest();
  assert.equal(await c.shouldAskSignIn(), false);
  assert.equal(mem["voidpop:auth-choice:v1"], "guest"); // saved, so the next launch doesn't ask again
  assert.equal(c.currentUser(), null);               // a guest is simply nobody: everything stays on the phone
  assert.equal(await c.pushVerdict("anime", "1", { verdict: "peak", status: "completed" }), false);
});

test("Google sign-in: makes the account, signs this device in, and clears the guest choice", async () => {
  const seen = [];
  const off = c.onAccountChange((u) => seen.push(u?.username ?? null));
  const r = await c.loginWithGoogle(idp.jwt(claims()));
  assert.deepEqual([r.isNew, r.linked, r.user.username, r.user.providers], [true, false, "Ria_Sharma", ["google"]]);
  assert.equal(c.currentUser().username, "Ria_Sharma");
  assert.equal(mem["voidpop:auth-choice:v1"], undefined);
  assert.equal(await c.shouldAskSignIn(), false); // signed in
  assert.equal(await c.pushVerdict("anime", "1", { verdict: "peak", status: "completed" }), true); // the token works
  off();
  assert.deepEqual(seen, ["Ria_Sharma"]);
});

test("signing out leaves you a guest, and the same Google account signs back in to the same account", async () => {
  const id = c.currentUser().id;
  await c.logout();
  assert.deepEqual([c.currentUser(), await c.shouldAskSignIn()], [null, false]);
  const r = await c.loginWithGoogle(idp.jwt(claims({ name: "Other" })));
  assert.deepEqual([r.isNew, r.user.id], [false, id]);
});

test("a refused Google token does not sign you out of the account you are in", async () => {
  const forged = generateKeyPairSync("rsa", { modulusLength: 2048 }).privateKey;
  await assert.rejects(() => c.loginWithGoogle(idp.jwt(claims({ sub: "g-2" }), { key: forged })), (e) => e.status === 401 && /couldn't be verified/.test(e.message));
  assert.equal(c.currentUser().username, "Ria_Sharma"); // still signed in
});

test("connecting Google to an email account, and picking your own username", async () => {
  await c.logout();
  await c.register({ email: "kiran@x.com", username: "kiran", password: "password123" });
  // the same email arriving through Google must not just slide into that account
  await c.logout();
  await assert.rejects(() => c.loginWithGoogle(idp.jwt(claims({ sub: "g-k", email: "kiran@x.com" }))), (e) => e.status === 409);
  await c.login({ identifier: "kiran", password: "password123" });
  const r = await c.loginWithGoogle(idp.jwt(claims({ sub: "g-k", email: "kiran@x.com" }))); // signed in: connects
  assert.deepEqual([r.linked, r.user.providers, c.currentUser().providers], [true, ["google"], ["google"]]);

  const u = await c.updateUsername("kiran_rai");
  assert.equal(u.username, "kiran_rai");
  assert.equal(c.currentUser().username, "kiran_rai");
  await assert.rejects(() => c.updateUsername("Ria_Sharma"), (e) => e.status === 409);
});

test("a login that has expired signs you out and you are asked again; guests are not", async () => {
  assert.equal(await c.shouldAskSignIn(), false);
  clock += 31 * 86400000; // past the 30 days a login lasts
  await assert.rejects(() => c.postComment("anime", "1", "hello"), (e) => e.status === 401);
  assert.equal(c.currentUser(), null);
  assert.equal(await c.shouldAskSignIn(), true); // not "guest": they had an account, so they are offered sign-in again
  await c.chooseGuest();
  assert.equal(await c.shouldAskSignIn(), false);
});

test("deleting the account leaves you a guest", async () => {
  clock = Date.now();
  await c.loginWithGoogle(idp.jwt(claims({ sub: "g-del", email: "del@x.com", name: "Del Me" })));
  await c.deleteAccount();
  assert.deepEqual([c.currentUser(), await c.shouldAskSignIn()], [null, false]);
});

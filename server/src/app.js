// The API. One function, `createApp`, returns a plain Node request listener (no framework).
// Everything is JSON. Logged-in calls send  Authorization: Bearer <token>.
//
//   POST   /api/auth/register            { email, username, password } → { token, user }
//   POST   /api/auth/login               { identifier, password }      → { token, user }
//   GET    /api/auth/providers                                         → { google, apple }  (which sign-ins this server has set up)
//   POST   /api/auth/google              { idToken }                   → { token, user, isNew }  (signed in: connects Google to your account)
//   POST   /api/auth/apple               { identityToken, name? }      → { token, user, isNew }  (same)
//   GET    /api/me                                                     → { user }
//   PATCH  /api/me                       { username }                  → { user }
//   DELETE /api/me                                                     delete the account and everything on it
//   PUT    /api/verdicts/:segment/:id    { verdict, status, moods?, title?, image? }
//   POST   /api/verdicts/bulk            { items: [{ segment, id, verdict, status, moods?, title?, image? }] } → { saved, skipped }   (up to 100; a new account's existing library)
//   DELETE /api/verdicts/:segment/:id
//   GET    /api/titles/:segment/:id/verdicts                           → { total, counts, mine? }
//   GET    /api/rankings?min=20                                        → { titles: [{ segment, id, title, image, total, counts }] }  (Explore: Best out there, Popular in town, Most loved)
//   GET    /api/titles/:segment/:id/comments?before=<id>               → { comments, nextBefore }
//   POST   /api/titles/:segment/:id/comments { body, parentId? }       → { comment }
//   PATCH  /api/comments/:id             { body }
//   DELETE /api/comments/:id
//   PUT    /api/comments/:id/like        DELETE the same path to unlike
//   GET    /api/sync                                                   → { data, version } | { data: null, version: 0 }
//   PUT    /api/sync                     { data, baseVersion }         → { version }   (409 if someone else saved first)
//   GET    /api/health

import { createHash, randomInt } from "node:crypto";
import { hashPassword, checkPassword, makeTokens } from "./auth.js";
import { makeVerifier, OidcError, GOOGLE, APPLE } from "./oidc.js";

export const SEGMENTS = ["anime", "manga", "novel", "movie", "tv"];
export const VERDICT_KEYS = ["peak", "divein", "onetime", "voidit"];
// a verdict counts in the community split only when the person finished or dropped it
// ("rewatching" is a finished title being watched again, so it still counts)
export const COUNTED = ["completed", "dropped", "watched", "rewatching"];
// every status the app has (its "On Hold" is "onhold"; "paused" is kept for older clients): a verdict is never refused over its status
const STATUSES = ["completed", "dropped", "watched", "rewatching", "watching", "plan", "considering", "onhold", "paused"];

const MAX_BODY = 16 * 1024;
const MAX_SYNC = 5 * 1024 * 1024;
const MAX_BULK_ITEMS = 100;
const MAX_BULK_BODY = 256 * 1024;
const PAGE = 20;

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
const bad = (m) => new HttpError(400, m);

// google / apple: the client ids a sign-in token must have been issued for (empty = that sign-in is off).
// fetchJson: how the provider's public keys are fetched (tests pass a fake; the default is fetch).
export function createApp({ db, secret, origins = "*", trustProxy = false, now = () => Date.now(), google = [], apple = [], fetchJson }) {
  const tokens = makeTokens(secret);
  const iso = () => new Date(now()).toISOString();

  /* ---------- tiny rate limiter (per IP, per kind, per minute) ---------- */
  const hits = new Map();
  function limit(req, kind, max) {
    const fwd = trustProxy ? String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() : "";
    const key = `${kind}:${fwd || req.socket.remoteAddress}`;
    const t = now();
    const h = hits.get(key);
    if (!h || t - h.at > 60000) hits.set(key, { at: t, n: 1 });
    else if (++h.n > max) throw new HttpError(429, "Too many requests. Wait a minute and try again.");
    if (hits.size > 5000) for (const [k, v] of hits) if (t - v.at > 60000) hits.delete(k);
  }

  /* ---------- helpers ---------- */
  const userRow = (id) => db.prepare("SELECT id, email, username, created_at FROM users WHERE id = ?").get(id);
  // an account made with Google or Apple that shared no email has a made-up one (a reserved ".invalid" address): never shown
  const PLACEHOLDER = "@sign-in.invalid";
  const providersOf = (id) => db.prepare("SELECT provider FROM identities WHERE user_id = ? ORDER BY provider").all(id).map((r) => r.provider);
  const publicUser = (u) => ({
    id: u.id, username: u.username, email: u.email.endsWith(PLACEHOLDER) ? null : u.email, createdAt: u.created_at,
    providers: providersOf(u.id), // ["google", "apple"]: what is connected to this account
  });

  function authed(req, required = true) {
    const m = /^Bearer (.+)$/.exec(req.headers.authorization || "");
    const uid = m ? tokens.verify(m[1], now()) : null;
    const user = uid ? userRow(uid) : null;
    if (!user && required) throw new HttpError(401, "Sign in first.");
    return user;
  }

  const seg = (s) => { if (!SEGMENTS.includes(s)) throw bad("Unknown type of title."); return s; };
  const itemId = (s) => { if (!/^[\w:-]{1,40}$/.test(s)) throw bad("Bad title id."); return s; };
  const text = (v, min, max, what) => {
    const t = typeof v === "string" ? v.trim() : "";
    if (t.length < min || t.length > max) throw bad(`${what} must be ${min === max ? min : `${min}–${max}`} characters.`);
    return t;
  };

  function commentOut(c, me) {
    return {
      id: c.id, parentId: c.parent_id, deleted: !!c.deleted,
      body: c.deleted ? "" : c.body,
      author: c.username, verdict: c.verdict || null,
      likes: c.likes, liked: !!c.liked, mine: !!me && c.user_id === me.id,
      createdAt: c.created_at, editedAt: c.edited_at, replies: [],
    };
  }

  // one query shape for listing comments (the author's verdict on the same title rides along)
  const COMMENT_SELECT = `
    SELECT c.*, u.username,
           (SELECT v.verdict FROM verdicts v WHERE v.user_id = c.user_id AND v.segment = c.segment AND v.item_id = c.item_id) AS verdict,
           (SELECT COUNT(*) FROM comment_likes l WHERE l.comment_id = c.id) AS likes,
           (SELECT COUNT(*) FROM comment_likes l WHERE l.comment_id = c.id AND l.user_id = ?) AS liked
    FROM comments c JOIN users u ON u.id = c.user_id`;

  /* ---------- routes ---------- */
  const routes = [];
  const route = (method, pattern, fn) => routes.push({ method, re: new RegExp(`^${pattern}$`), fn });

  route("GET", "/api/health", () => ({ ok: true }));

  route("POST", "/api/auth/register", (req, { body }) => {
    limit(req, "auth", 10);
    const email = text(body.email, 5, 254, "Email").toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw bad("That doesn't look like an email address.");
    const username = text(body.username, 3, 24, "Username");
    if (!/^[A-Za-z0-9_]+$/.test(username)) throw bad("Usernames can use letters, numbers and _ only.");
    const password = text(body.password, 8, 128, "Password");
    if (db.prepare("SELECT 1 FROM users WHERE email = ?").get(email)) throw new HttpError(409, "That email already has an account.");
    if (db.prepare("SELECT 1 FROM users WHERE username = ?").get(username)) throw new HttpError(409, "That username is taken.");
    const r = db.prepare("INSERT INTO users (email, username, pass_hash, created_at) VALUES (?, ?, ?, ?)")
      .run(email, username, hashPassword(password), iso());
    const user = userRow(Number(r.lastInsertRowid));
    return [201, { token: tokens.issue(user.id, now()), user: publicUser(user) }];
  });

  route("POST", "/api/auth/login", (req, { body }) => {
    limit(req, "auth", 10);
    const id = text(body.identifier, 1, 254, "Email or username");
    const password = typeof body.password === "string" ? body.password : "";
    const row = db.prepare("SELECT * FROM users WHERE email = ? OR username = ?").get(id, id);
    // the same answer for "no such user" and "wrong password"
    if (!row || !checkPassword(password, row.pass_hash)) throw new HttpError(401, "Wrong email, username or password.");
    return { token: tokens.issue(row.id, now()), user: publicUser(row) };
  });

  /* ---------- sign in with Google / Apple ---------- */
  // The phone gets an ID token from Google or Apple and sends it here; oidc.js checks its signature and who it is for.
  //   signed out + already connected → sign in to that account
  //   signed out + new               → make an account (no password: nothing can match NO_PASSWORD)
  //   signed in                      → connect that Google/Apple account to the signed-in account
  // An email that already belongs to a password account is NEVER linked automatically. Sign-up here doesn't verify
  // email, so whoever registered an address first would otherwise get into the real owner's Google account.
  // The owner signs in with the password first, then connects Google from Account.
  const verifyToken = makeVerifier({ fetchJson, now });
  const SOCIAL = {
    google: { ...GOOGLE, label: "Google", audiences: google, field: "idToken" },
    apple: { ...APPLE, label: "Apple", audiences: apple, field: "identityToken" },
  };
  const NO_PASSWORD = "!"; // checkPassword() never matches this
  const placeholderEmail = (provider, sub) => `${provider}-${createHash("sha256").update(sub).digest("hex").slice(0, 20)}${PLACEHOLDER}`;

  // a username nobody has, from the first hint that has 3+ usable characters (names in other scripts have none: the email's start is the fallback)
  function freeUsername(...hints) {
    let base = "";
    for (const hint of hints) {
      const s = String(hint || "").replace(/[^A-Za-z0-9_]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 18);
      if (s.length >= 3) { base = s; break; }
    }
    if (!base) base = "voidpop";
    let name = base;
    for (let i = 0; i < 20 && db.prepare("SELECT 1 FROM users WHERE username = ?").get(name); i++) name = `${base}${randomInt(1000, 10000)}`;
    return name;
  }

  async function socialSignIn(req, provider, body) {
    limit(req, "auth", 10);
    const p = SOCIAL[provider];
    if (!p.audiences.length) throw new HttpError(503, `Sign in with ${p.label} isn't set up on this server.`);
    const raw = body[p.field];
    if (typeof raw !== "string" || !raw || raw.length > 8192) throw bad(`Missing ${p.label} sign-in.`);
    let claims;
    try { claims = await verifyToken(raw, p); }
    catch (e) {
      if (e instanceof OidcError) throw new HttpError(e.kind === "unavailable" ? 503 : 401, e.message);
      throw e;
    }
    // from here on nothing waits, so the checks and the inserts below can't interleave with another request
    const me = authed(req, false);
    const linked = db.prepare("SELECT user_id FROM identities WHERE provider = ? AND subject = ?").get(provider, claims.sub);
    if (linked) {
      if (me && me.id !== linked.user_id) throw new HttpError(409, `That ${p.label} account is already connected to a different VoidPop account.`);
      const user = userRow(linked.user_id);
      return { token: tokens.issue(user.id, now()), user: publicUser(user), isNew: false };
    }
    const email = claims.email && claims.emailVerified ? claims.email : null;
    if (me) {
      db.prepare("INSERT INTO identities (provider, subject, user_id, email, created_at) VALUES (?, ?, ?, ?, ?)").run(provider, claims.sub, me.id, email, iso());
      return { token: tokens.issue(me.id, now()), user: publicUser(me), isNew: false, linked: true };
    }
    if (email && db.prepare("SELECT 1 FROM users WHERE email = ?").get(email)) {
      throw new HttpError(409, `That email already has a VoidPop account. Sign in with your password, then connect ${p.label} from Account.`);
    }
    const username = freeUsername(body.name, claims.name, email ? email.split("@")[0] : "");
    let uid;
    db.exec("BEGIN");
    try {
      const r = db.prepare("INSERT INTO users (email, username, pass_hash, created_at) VALUES (?, ?, ?, ?)").run(email || placeholderEmail(provider, claims.sub), username, NO_PASSWORD, iso());
      uid = Number(r.lastInsertRowid);
      db.prepare("INSERT INTO identities (provider, subject, user_id, email, created_at) VALUES (?, ?, ?, ?, ?)").run(provider, claims.sub, uid, email, iso());
      db.exec("COMMIT");
    } catch (e) { db.exec("ROLLBACK"); throw e; }
    const user = userRow(uid);
    return [201, { token: tokens.issue(user.id, now()), user: publicUser(user), isNew: true }];
  }

  route("GET", "/api/auth/providers", () => ({ google: google.length > 0, apple: apple.length > 0 }));
  route("POST", "/api/auth/google", (req, { body }) => socialSignIn(req, "google", body));
  route("POST", "/api/auth/apple", (req, { body }) => socialSignIn(req, "apple", body));

  route("GET", "/api/me", (req) => ({ user: publicUser(authed(req)) }));

  // people who came in with Google or Apple get a made-up username: this is how they pick their own
  route("PATCH", "/api/me", (req, { body }) => {
    limit(req, "write", 60);
    const me = authed(req);
    const username = text(body.username, 3, 24, "Username");
    if (!/^[A-Za-z0-9_]+$/.test(username)) throw bad("Usernames can use letters, numbers and _ only.");
    const taken = db.prepare("SELECT id FROM users WHERE username = ?").get(username);
    if (taken && taken.id !== me.id) throw new HttpError(409, "That username is taken.");
    db.prepare("UPDATE users SET username = ? WHERE id = ?").run(username, me.id);
    return { user: publicUser(userRow(me.id)) };
  });

  route("DELETE", "/api/me", (req) => {
    const me = authed(req);
    db.prepare("DELETE FROM users WHERE id = ?").run(me.id); // verdicts, comments, likes, sync go with it (ON DELETE CASCADE)
    return { ok: true };
  });

  // One verdict, checked and saved. Throws a 400 for anything wrong, so callers decide whether that stops them (PUT) or just skips it (bulk).
  function saveVerdict(me, segment, id, body) {
    if (!VERDICT_KEYS.includes(body.verdict)) throw bad("Unknown verdict.");
    if (!STATUSES.includes(body.status)) throw bad("Unknown status.");
    const moods = Array.isArray(body.moods) ? body.moods.filter((x) => typeof x === "string").slice(0, 6).map((x) => x.slice(0, 80)) : [];
    db.prepare(`INSERT INTO verdicts (user_id, segment, item_id, verdict, status, moods, title, image, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT (user_id, segment, item_id) DO UPDATE SET
                  verdict = excluded.verdict, status = excluded.status, moods = excluded.moods,
                  title = excluded.title, image = excluded.image, updated_at = excluded.updated_at`)
      .run(me.id, segment, id, body.verdict, body.status, JSON.stringify(moods),
        typeof body.title === "string" ? body.title.slice(0, 200) : null,
        typeof body.image === "string" && /^https:\/\//.test(body.image) ? body.image.slice(0, 500) : null, iso());
  }

  route("PUT", "/api/verdicts/([^/]+)/([^/]+)", (req, { m, body }) => {
    limit(req, "write", 60);
    const me = authed(req);
    saveVerdict(me, seg(m[1]), itemId(m[2]), body);
    return { ok: true };
  });

  // Everything someone already had on their phone as a guest, shared in one go when they sign in. One bad item
  // is skipped, not fatal; the app sends 100 at a time.
  route("POST", "/api/verdicts/bulk", (req, { body }) => {
    limit(req, "bulk", 20);
    const me = authed(req);
    if (!Array.isArray(body.items) || body.items.length > MAX_BULK_ITEMS) throw bad(`Send between 0 and ${MAX_BULK_ITEMS} verdicts at a time.`);
    let saved = 0;
    db.exec("BEGIN");
    try {
      for (const it of body.items) {
        try { saveVerdict(me, seg(it?.segment), itemId(String(it?.id)), it); saved += 1; } catch (e) { if (!(e instanceof HttpError)) throw e; }
      }
      db.exec("COMMIT");
    } catch (e) { db.exec("ROLLBACK"); throw e; }
    return { saved, skipped: body.items.length - saved };
  });

  route("DELETE", "/api/verdicts/([^/]+)/([^/]+)", (req, { m }) => {
    limit(req, "write", 60);
    const me = authed(req);
    db.prepare("DELETE FROM verdicts WHERE user_id = ? AND segment = ? AND item_id = ?").run(me.id, seg(m[1]), itemId(m[2]));
    return { ok: true };
  });

  route("GET", "/api/titles/([^/]+)/([^/]+)/verdicts", (req, { m }) => {
    const segment = seg(m[1]); const id = itemId(m[2]);
    const rows = db.prepare(`SELECT verdict, COUNT(*) AS n FROM verdicts
      WHERE segment = ? AND item_id = ? AND status IN (${COUNTED.map(() => "?").join(",")}) GROUP BY verdict`).all(segment, id, ...COUNTED);
    const counts = Object.fromEntries(VERDICT_KEYS.map((k) => [k, 0]));
    for (const r of rows) counts[r.verdict] = r.n;
    const out = { total: Object.values(counts).reduce((a, b) => a + b, 0), counts };
    const me = authed(req, false);
    if (me) {
      const mine = db.prepare("SELECT verdict, status FROM verdicts WHERE user_id = ? AND segment = ? AND item_id = ?").get(me.id, segment, id);
      if (mine) out.mine = mine;
    }
    return out;
  });

  // Every title with at least `min` counted verdicts and how they split. Explore turns this into its community rows
  // (shared/features/communityRank.js); the server only counts, the rules for each row live there.
  route("GET", "/api/rankings", (req, { query }) => {
    const min = Math.min(Math.max(Number(query.get("min")) || 20, 1), 1000);
    const rows = db.prepare(`SELECT segment, item_id, MAX(title) AS title, MAX(image) AS image, verdict, COUNT(*) AS n FROM verdicts
      WHERE status IN (${COUNTED.map(() => "?").join(",")}) GROUP BY segment, item_id, verdict`).all(...COUNTED);
    const byTitle = new Map();
    for (const r of rows) {
      const key = `${r.segment}:${r.item_id}`;
      if (!byTitle.has(key)) byTitle.set(key, { segment: r.segment, id: r.item_id, title: r.title || null, image: r.image || null, total: 0, counts: Object.fromEntries(VERDICT_KEYS.map((k) => [k, 0])) });
      const t = byTitle.get(key);
      t.title = t.title || r.title || null; t.image = t.image || r.image || null;
      if (r.verdict in t.counts) { t.counts[r.verdict] = r.n; t.total += r.n; }
    }
    return { titles: [...byTitle.values()].filter((t) => t.total >= min).sort((a, b) => b.total - a.total).slice(0, 500) };
  });

  route("GET", "/api/titles/([^/]+)/([^/]+)/comments", (req, { m, query }) => {
    const segment = seg(m[1]); const id = itemId(m[2]);
    const me = authed(req, false);
    const before = Number(query.get("before")) || Number.MAX_SAFE_INTEGER;
    const top = db.prepare(`${COMMENT_SELECT}
      WHERE c.segment = ? AND c.item_id = ? AND c.parent_id IS NULL AND c.id < ?
        AND (c.deleted = 0 OR EXISTS (SELECT 1 FROM comments r WHERE r.parent_id = c.id AND r.deleted = 0))
      ORDER BY c.id DESC LIMIT ?`).all(me?.id ?? 0, segment, id, before, PAGE + 1);
    const page = top.slice(0, PAGE);
    const comments = page.map((c) => commentOut(c, me));
    const byId = new Map(comments.map((c) => [c.id, c]));
    for (const c of page) {
      const replies = db.prepare(`${COMMENT_SELECT} WHERE c.parent_id = ? AND c.deleted = 0 ORDER BY c.id ASC LIMIT 100`).all(me?.id ?? 0, c.id);
      byId.get(c.id).replies = replies.map((r) => commentOut(r, me));
    }
    return { comments, nextBefore: top.length > PAGE ? page[page.length - 1].id : null };
  });

  route("POST", "/api/titles/([^/]+)/([^/]+)/comments", (req, { m, body }) => {
    limit(req, "write", 30);
    const me = authed(req);
    const segment = seg(m[1]); const id = itemId(m[2]);
    const content = text(body.body, 1, 1000, "A comment");
    let parentId = null;
    if (body.parentId != null) {
      const parent = db.prepare("SELECT * FROM comments WHERE id = ?").get(Number(body.parentId));
      if (!parent || parent.deleted || parent.segment !== segment || parent.item_id !== id) throw bad("The comment you're replying to is gone.");
      if (parent.parent_id) throw bad("Replies go one level deep.");
      parentId = parent.id;
    }
    const r = db.prepare("INSERT INTO comments (user_id, segment, item_id, parent_id, body, created_at) VALUES (?, ?, ?, ?, ?, ?)")
      .run(me.id, segment, id, parentId, content, iso());
    const row = db.prepare(`${COMMENT_SELECT} WHERE c.id = ?`).get(me.id, Number(r.lastInsertRowid));
    return [201, { comment: commentOut(row, me) }];
  });

  const ownComment = (me, cid) => {
    const c = db.prepare("SELECT * FROM comments WHERE id = ?").get(Number(cid));
    if (!c || c.deleted) throw new HttpError(404, "That comment is gone.");
    if (c.user_id !== me.id) throw new HttpError(403, "You can only change your own comments.");
    return c;
  };

  route("PATCH", "/api/comments/(\\d+)", (req, { m, body }) => {
    limit(req, "write", 30);
    const me = authed(req);
    const c = ownComment(me, m[1]);
    db.prepare("UPDATE comments SET body = ?, edited_at = ? WHERE id = ?").run(text(body.body, 1, 1000, "A comment"), iso(), c.id);
    const row = db.prepare(`${COMMENT_SELECT} WHERE c.id = ?`).get(me.id, c.id);
    return { comment: commentOut(row, me) };
  });

  route("DELETE", "/api/comments/(\\d+)", (req, { m }) => {
    limit(req, "write", 30);
    const me = authed(req);
    const c = ownComment(me, m[1]);
    db.prepare("UPDATE comments SET deleted = 1 WHERE id = ?").run(c.id); // replies stay; the text is never sent again
    return { ok: true };
  });

  route("PUT", "/api/comments/(\\d+)/like", (req, { m }) => {
    limit(req, "write", 60);
    const me = authed(req);
    const c = db.prepare("SELECT id, deleted FROM comments WHERE id = ?").get(Number(m[1]));
    if (!c || c.deleted) throw new HttpError(404, "That comment is gone.");
    db.prepare("INSERT OR IGNORE INTO comment_likes (comment_id, user_id) VALUES (?, ?)").run(c.id, me.id);
    return { ok: true };
  });
  route("DELETE", "/api/comments/(\\d+)/like", (req, { m }) => {
    limit(req, "write", 60);
    const me = authed(req);
    db.prepare("DELETE FROM comment_likes WHERE comment_id = ? AND user_id = ?").run(Number(m[1]), me.id);
    return { ok: true };
  });

  route("GET", "/api/sync", (req) => {
    const me = authed(req);
    const row = db.prepare("SELECT data, version, updated_at FROM sync WHERE user_id = ?").get(me.id);
    return row ? { data: row.data, version: row.version, updatedAt: row.updated_at } : { data: null, version: 0 };
  });

  route("PUT", "/api/sync", (req, { body }) => {
    limit(req, "write", 30);
    const me = authed(req);
    if (typeof body.data !== "string" || !body.data.length) throw bad("Nothing to save.");
    if (body.data.length > MAX_SYNC) throw new HttpError(413, "That backup is too big to sync.");
    try { JSON.parse(body.data); } catch { throw bad("The backup isn't valid."); }
    const row = db.prepare("SELECT version FROM sync WHERE user_id = ?").get(me.id);
    const current = row?.version ?? 0;
    if (Number(body.baseVersion) !== current) {
      throw Object.assign(new HttpError(409, "Another device saved first."), { extra: { version: current } });
    }
    db.prepare(`INSERT INTO sync (user_id, data, version, updated_at) VALUES (?, ?, ?, ?)
                ON CONFLICT (user_id) DO UPDATE SET data = excluded.data, version = excluded.version, updated_at = excluded.updated_at`)
      .run(me.id, body.data, current + 1, iso());
    return { version: current + 1 };
  });

  /* ---------- the Node request listener ---------- */
  function cors(req, res) {
    const origin = req.headers.origin;
    const allowed = origins === "*" ? "*" : origins.split(",").map((s) => s.trim()).includes(origin) ? origin : null;
    if (allowed) {
      res.setHeader("Access-Control-Allow-Origin", allowed);
      res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
      res.setHeader("Access-Control-Max-Age", "600");
      if (allowed !== "*") res.setHeader("Vary", "Origin");
    }
    res.setHeader("X-Content-Type-Options", "nosniff");
  }

  function readBody(req, max) {
    return new Promise((resolve, reject) => {
      let size = 0; const chunks = [];
      req.on("data", (c) => {
        size += c.length;
        if (size > max) { reject(new HttpError(413, "That request is too big.")); req.destroy(); return; }
        chunks.push(c);
      });
      req.on("end", () => {
        if (!chunks.length) return resolve({});
        try {
          const v = JSON.parse(Buffer.concat(chunks).toString("utf8"));
          resolve(v && typeof v === "object" && !Array.isArray(v) ? v : {});
        } catch { reject(bad("That wasn't valid JSON.")); }
      });
      req.on("error", reject);
    });
  }

  return async function handler(req, res) {
    cors(req, res);
    const send = (status, payload) => {
      if (res.headersSent) return;
      res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
      res.end(JSON.stringify(payload));
    };
    if (req.method === "OPTIONS") { res.writeHead(204); return res.end(); }
    try {
      const url = new URL(req.url, "http://localhost");
      const r = routes.find((x) => x.method === req.method && x.re.test(url.pathname));
      if (!r) throw new HttpError(404, "Not found.");
      const m = r.re.exec(url.pathname).map((x) => (x === undefined ? x : decodeURIComponent(x))); // m[1] is the first capture
      const body = req.method === "GET" || req.method === "DELETE" ? {} : await readBody(req, url.pathname === "/api/sync" ? MAX_SYNC + 1024 : url.pathname === "/api/verdicts/bulk" ? MAX_BULK_BODY : MAX_BODY);
      const out = await r.fn(req, { m, body, query: url.searchParams }); // await: sign-in with Google/Apple fetches keys
      return Array.isArray(out) ? send(out[0], out[1]) : send(200, out);
    } catch (e) {
      if (e instanceof HttpError) return send(e.status, { error: e.message, ...(e.extra || {}) });
      console.error("Unexpected error:", e);
      return send(500, { error: "Something went wrong on our side." });
    }
  };
}

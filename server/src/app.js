// The API. One function, `createApp`, returns a plain Node request listener (no framework).
// Everything is JSON. Logged-in calls send  Authorization: Bearer <token>.
//
//   POST   /api/auth/register            { email, username, password } → { token, user }
//   POST   /api/auth/login               { identifier, password }      → { token, user }
//   GET    /api/me                                                     → { user }
//   DELETE /api/me                                                     delete the account and everything on it
//   PUT    /api/verdicts/:segment/:id    { verdict, status, moods?, title?, image? }
//   DELETE /api/verdicts/:segment/:id
//   GET    /api/titles/:segment/:id/verdicts                           → { total, counts, mine? }
//   GET    /api/titles/:segment/:id/comments?before=<id>               → { comments, nextBefore }
//   POST   /api/titles/:segment/:id/comments { body, parentId? }       → { comment }
//   PATCH  /api/comments/:id             { body }
//   DELETE /api/comments/:id
//   PUT    /api/comments/:id/like        DELETE the same path to unlike
//   GET    /api/sync                                                   → { data, version } | { data: null, version: 0 }
//   PUT    /api/sync                     { data, baseVersion }         → { version }   (409 if someone else saved first)
//   GET    /api/health

import { hashPassword, checkPassword, makeTokens } from "./auth.js";

export const SEGMENTS = ["anime", "manga", "movie", "tv"];
export const VERDICT_KEYS = ["peak", "divein", "onetime", "voidit"];
// a verdict counts in the community split only when the person finished or dropped it
export const COUNTED = ["completed", "dropped", "watched"];
const STATUSES = ["completed", "dropped", "watched", "watching", "plan", "paused"];

const MAX_BODY = 16 * 1024;
const MAX_SYNC = 5 * 1024 * 1024;
const PAGE = 20;

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
const bad = (m) => new HttpError(400, m);

export function createApp({ db, secret, origins = "*", trustProxy = false, now = () => Date.now() }) {
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
  const publicUser = (u) => ({ id: u.id, username: u.username, email: u.email, createdAt: u.created_at });

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

  route("GET", "/api/me", (req) => ({ user: publicUser(authed(req)) }));

  route("DELETE", "/api/me", (req) => {
    const me = authed(req);
    db.prepare("DELETE FROM users WHERE id = ?").run(me.id); // verdicts, comments, likes, sync go with it (ON DELETE CASCADE)
    return { ok: true };
  });

  route("PUT", "/api/verdicts/([^/]+)/([^/]+)", (req, { m, body }) => {
    limit(req, "write", 60);
    const me = authed(req);
    const segment = seg(m[1]); const id = itemId(m[2]);
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
    return { ok: true };
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
      const body = req.method === "GET" || req.method === "DELETE" ? {} : await readBody(req, url.pathname === "/api/sync" ? MAX_SYNC + 1024 : MAX_BODY);
      const out = r.fn(req, { m, body, query: url.searchParams });
      return Array.isArray(out) ? send(out[0], out[1]) : send(200, out);
    } catch (e) {
      if (e instanceof HttpError) return send(e.status, { error: e.message, ...(e.extra || {}) });
      console.error("Unexpected error:", e);
      return send(500, { error: "Something went wrong on our side." });
    }
  };
}

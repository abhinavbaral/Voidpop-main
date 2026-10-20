# VoidPop server (`server/`)

The optional backend: **accounts, community Void Verdicts, comments and cloud backup.**
The app and website work fully without it; with it, sign-in, comments and the Void Verdict
meter appear.

- Plain Node, **no dependencies, no install step.** Needs **Node 22.5+** (it uses the built-in SQLite).
- One database file: `server/data/voidpop.db` (set `VOIDPOP_DB` to move it). It is git-ignored.
- Passwords are hashed with scrypt; login tokens are signed with `VOIDPOP_SECRET` and last 30 days.

```sh
npm run server            # from the repo root; listens on http://localhost:8787
npm test --prefix server  # the API tests
```

Copy `.env.example` to `.env` (or set the variables in your host) before deploying. **Set
`VOIDPOP_SECRET` to a long random string**: without it a temporary one is made and everyone is
signed out on every restart.

## Point the clients at it

| Where | Setting |
|---|---|
| website (`web/.env.local`) | `VITE_VOIDPOP_API=http://localhost:8787` |
| app (`app/.env`) | `EXPO_PUBLIC_VOIDPOP_API=http://<your computer's address>:8787` (a phone can't reach `localhost`) |

## What it stores, and what the community sees

| Data | Who sees it |
|---|---|
| email | only the server (used to sign in, never returned to others) |
| username, comments, replies, likes | everyone |
| your verdict on a title (verdict, status, up to 6 moods, title name and small poster) | counted anonymously in the split; shown as a chip next to your comments on that title |
| cloud backup (your whole library JSON) | only you |

The split counts a verdict only when its status is Completed, Dropped or Watched, so people
still on episode 2 don't count. The clients hide the split until 20 people are in it.
Deleting your account (`DELETE /api/me`) removes all of the above.

## API

Everything is JSON; signed-in calls send `Authorization: Bearer <token>`. The full list is in the
header of [`src/app.js`](src/app.js). Highlights:

```
POST /api/auth/register  { email, username, password }
POST /api/auth/login     { identifier, password }
PUT  /api/verdicts/:segment/:id        segment: anime | manga | movie | tv
GET  /api/titles/:segment/:id/verdicts → { total, counts }
GET  /api/titles/:segment/:id/comments?before=<id>
POST /api/titles/:segment/:id/comments { body, parentId? }
GET/PUT /api/sync                      cloud backup, guarded by a version number
```

## Before going public

- Put it behind HTTPS (a reverse proxy, or a host that does it for you) and set `VOIDPOP_ORIGINS`
  to your website's address. Set `TRUST_PROXY=1` only when behind a proxy you control.
- Run it where the database file is kept on a persistent disk, and back that file up.
- The rate limits are in memory and per process, enough for one small server. Behind several
  servers use a shared store.
- There is **no email verification, password reset or moderation tooling yet** (see `Docs/Updates.txt`).
  Comments are only editable and deletable by their author.
- Moving to Postgres later: the SQL is in `src/db.js` and `src/app.js` only.

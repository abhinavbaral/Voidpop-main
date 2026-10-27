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

## Sign in with Google / Apple (and guest)

Email + password works out of the box. Google and Apple are **off until you set their client ids**; the
app only shows a button when the server has that sign-in on *and* the phone can do it. Anyone can also
**continue as a guest**: no account, everything stays on the phone, as before.

How it works: the phone asks Google/Apple who you are and gets a signed token; the server checks the
signature, that it was issued for *your* app, and that it hasn't expired ([`src/oidc.js`](src/oidc.js)).
Nothing else the phone says is trusted. Accounts made this way have no password.

**Google**
1. [Google Cloud Console](https://console.cloud.google.com) → create a project → *Google Auth Platform* (consent screen) → *Clients*.
2. Create a **Web application** client. Its client id goes in **two places**: `GOOGLE_CLIENT_IDS` on the server and
   `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` in `app/.env`.
3. Create an **Android** client: package name `com.voidation.app` and the **SHA-1 of the key that signs your APK**
   (`eas credentials` shows it; a debug build and a release build have different ones, so add each you use). Nothing in the
   code uses this id: it is what lets Google trust the app.
4. In `app/`: `npx expo install expo-apple-authentication @react-native-google-signin/google-signin`
5. Build a **new APK**. These are native modules: an over-the-air update can't add them, and Expo Go can't run Google sign-in.

**Apple** (iOS only; the button is never shown on Android)
- Needs the paid Apple Developer Program. Set `APPLE_CLIENT_IDS=com.voidation.app` (the bundle id) on the server.
- The Google library also needs its config plugin for iOS: add `["@react-native-google-signin/google-signin", { "iosUrlScheme": "com.googleusercontent.apps.<your iOS client id>" }]` to `app.json` plugins when you build for iOS.
- Apple requires Sign in with Apple in any iOS app that offers Google, and requires in-app account deletion (already here: More → Account).

**Good to know**
- An email that already belongs to a password account is **never linked automatically** (sign-up here doesn't verify
  email, so that would let whoever registered an address first into its owner's Google account). Sign in with the
  password first, then *Connect Google* in More → Account.
- People who share no email (Apple's "hide my email") get a made-up address that is never shown or returned.
- Usernames are made from the name (else the email); people change them in More → Account (`PATCH /api/me`).
- The checking is tested against a fake Google that signs real tokens (`test/idp.js`). The phone side (the Google and
  Apple sheets) can only be tried on a real build.

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
POST /api/auth/google    { idToken }          also /apple { identityToken, name? }; signed in = connect to your account
GET  /api/auth/providers → { google, apple }  which sign-ins this server has set up
PATCH /api/me            { username }
POST /api/verdicts/bulk  { items: [...] }     up to 100 verdicts at once: a new account's existing library
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

# VoidPop

**Anime, manga, movies and series, with live countdowns to the next episode.** A website, an
Android app and an optional backend, built from one codebase. No sign-up and no API keys needed:
open it and use it. Accounts, comments and community verdicts switch on when you run the server.

- **Explore (home):** a Billboard that changes on every refresh (an anime, movie or TV series), your new episodes and
  countdowns, search across everything, then a grid of tiles (Coming soon, Anime of the Year, Oscars, Emmys, Jump back in,
  New seasons, Don't Miss This for each kind, VoidPop Angles) and poster rows that mix anime, manga, novels, movies and TV
  (Popular in town, Peak like …, Dive in like …, One time like …, Most loved)
- **Movies & TV (app: Explore → Browse → Movies / TV; website: `/cinema`):** browse films and series by
  genre, country and sort, save each to your Library (Movies and TV are separate kinds: TV has the same playlists as Anime, Movies have their own), and give it a Void Verdict. Sample titles out of the box;
  a free TMDB key makes it live
- **Community (optional, needs the server):** accounts, comments with replies and likes on every title, and the
  **Void Verdict meter** ("58% Peak · 28% Dive In …"), hidden until 20 people who finished or dropped it have given a verdict.
  Cloud backup and restore between devices
- **Schedule:** a live countdown for every airing anime you follow, plus everything
  airing this week, grouped by day in your own time zone
- **Track** anime (Watching / Completed / Plan to Watch / On Hold / Dropped) and manga
  (Reading / Finished / Plan to Read …), including manhwa, manhua and donghua
- **Your verdict** instead of a number: Peak / Dive In / One Time / Void It, plus up to
  three vibes, shareable as an image card
- **Explore, Browse and Search** by origin (Japan, Korea, China), season, year and popularity
- **Tiers** that grow with what you complete, from Newbie to Addicted (15 ranks)
- **History:** episodes that aired in the last 14 days for everything you follow
- **More:** statistics, appearance, settings (24-hour clock, countdown badges), data and storage, help, about
- **Progress:** episodes watched / chapters read on every title, +1 from the Library, "Mark watched" in History,
  "2 new" when you're behind; marking the last episode asks for your verdict
- **Import from AniList** by username (public lists, no key); a title in both keeps whichever copy changed last
- **Library search and sort** (recently updated, A–Z, airing soonest, most to catch up)
- **Delayed label** when a followed show's next episode moves later, with the original date
- **AniList sync (two-way):** sign in with AniList; status and progress stay the same on the app, the website and
  AniList. Verdicts, Excited and the watch log stay on the device. See "Set up AniList sync" below.
- **Select:** long-press titles in a playlist to bulk move or remove them
- **Genre and studio filters** on the Season chart and Schedule; genre filter in Browse
- **Background work (Android):** about hourly while closed: backup, episode alerts, widget, sync
- **Explore only shows new things:** titles in your library or marked Excited are left out
- **Watching this season + Pending:** aired-but-unwatched episodes of your Watching anime; new episodes add
  to it automatically, +1 takes one off; a count badge on the Schedule tab
- **Watch log:** every progress change is saved with its date (for stats and History); imports don't count
- **Type your progress** (tap the number); you can't go past what's out: aired episodes, or a finished manga's chapter count
- **Works offline:** the latest AniList answers are kept on the device (size-capped) and used when there's no internet
- **Season chart:** a season's anime grouped by format, with countdowns and one-tap Plan to Watch
- **Verdict recommendations:** "Peak like X", "Dive in like X", "One time like X" (Void It gets none)
- **Add to calendar:** the phone's own event screen (app), Google Calendar or an .ics file (website), weekly for the remaining episodes
- **Share a countdown** as an image
- **Android widget** with the next episode of up to 30 shows you follow (needs the APK; not available in Expo Go)
- **Where to watch / read:** official streaming and reading services for each title (from AniList)
- **Episode alerts (app):** a notification when an episode airs for anything you follow or are Excited about
- **Automatic backups (Android, Mihon-style):** pick a folder once; backups run on a schedule (12h / daily / weekly),
  the newest 5 are kept, and they survive uninstalling. Manual share and restore-from-file too
- Trailers open in YouTube (YouTube blocks in-app embeds with "Error 153")

Data comes from the public [AniList](https://anilist.co) GraphQL API, which needs no key.

```
voidpop/
├── app/      Android + iOS app: Expo / React Native
├── web/      Website: React + Vite
├── server/   Backend: accounts, verdicts, comments, cloud backup (Node, no dependencies)
└── shared/   Everything both products must agree on, written once:
              api/ (AniList, TMDB, VoidPop server), backend/ (your data), features/ (rules),
              lib/ (helpers), demo/ (sample data), test/
```

Only the UI is written twice. What a screen shows, how the library is stored and how a
countdown is formatted all live in `shared/`, so the app and the site cannot drift apart.

## Run it

```sh
npm install        # installs app, web and shared together (npm workspaces)
npm run web        # website at http://localhost:5173
npm run app        # mobile app — scan the QR code with Expo Go
npm run web:demo   # website offline on a sample library (for presentations)
npm run app:demo   # same for the app
npm run server     # the backend at http://localhost:8787 (needs Node 22.5+)
```

To try accounts and comments locally: run `npm run server`, then put
`VITE_VOIDPOP_API=http://localhost:8787` in `web/.env.local` (or `EXPO_PUBLIC_VOIDPOP_API` in `app/.env`;
on a real phone use your computer's address, not localhost). Details in [server/README.md](server/README.md).
For live movies and series add `VITE_TMDB_API_KEY` / `EXPO_PUBLIC_TMDB_API_KEY`.

## Checks before you commit

```
npm run check        # lint + tests for shared and server (fast)
npm run check:app    # full Android bundle (slower)
```

How the code is organised: see [ARCHITECTURE.md](ARCHITECTURE.md).

## Where your data lives

The library is one JSON document on your device: `localStorage` in the browser, `AsyncStorage`
on the phone (`shared/backend/storage.js`). More → Data and storage exports it as a backup file
and restores it. Every screen reads and writes through `shared/backend/store.js`.

A VoidPop account is optional and adds only the social parts: your **comments** and the
**verdicts you give** (with your username, never your email) are visible to others, and an optional
**cloud backup** of your library is private to you. The library itself is never uploaded unless you
press Back up. You can delete the account and everything on it from the Account page.

## Deploy

**Website → Vercel.** Import the repo with the Root Directory left at the repo root;
`vercel.json` already sets the build command, the output folder and the rewrite that
makes deep links like `/title/anime/16498` work.

**Android APK → EAS Build** (free Expo account):

```sh
npm i -g eas-cli
cd app
eas login
eas build -p android --profile preview   # gives you a download link to an .apk
```

## History

VoidPop began as a larger pop-culture tracker: anime, manga, movies, web series, a social
feed and accounts. This codebase is the main VoidPop app now. It covers anime, manga and
novels with the airing countdowns, plus movies and series, accounts, comments and community
verdicts. The social feed (Mesh) is not coming back. The personal note on a title was replaced
by comments (notes you saved earlier are kept and still appear in the Markdown export).

## Set up AniList sync (free, once)

AniList lets any app sign users in for free; it just needs to know where to send
them back. Each place VoidPop runs needs its own AniList app (one redirect URL each).

1. Sign in at anilist.co, open **Settings → Developer → Create new client**.
2. **App (APK):** name `VoidPop`, redirect URL `voidation://auth`. Copy the client id into
   `app/.env` as `EXPO_PUBLIC_ANILIST_CLIENT_ID=…`, then build the APK.
   (For EAS, also add it under the build profile's `env`, or as an EAS environment variable.)
3. **Website:** create a second client with redirect URL `https://<your site>/auth/anilist`
   (and a third with `http://localhost:5173/auth/anilist` for local testing if you like).
   Put its id in `web/.env` as `VITE_ANILIST_CLIENT_ID=…`, or in Vercel's environment variables.
4. More → AniList → **Sign in with AniList**.

Client ids aren't secret (the sign-in happens on AniList's own page), but keep
`.env` files out of git anyway. Expo Go uses a different return address, shown
on the More → AniList page, so test sign-in on the website or the APK.

## Updating the app without a new build (EAS Update)

Build the APK once; after that, most changes reach phones as an update in a
minute or two, with no build queue and no reinstall.

One-time setup (from `app/`):

    npx eas-cli update:configure
    npx eas-cli build -p android --profile preview

Install that APK. From then on, after changing code (from `app/`):

    npx eas-cli update --channel preview --message "what changed"

Open VoidPop, close it completely, open it again: the update is in.

A new APK is only needed when a native library is added or changed (a new
`expo-*` or `react-native-*` package, or app.json plugins/permissions).

The runtime version is the app version (`"version"` in app/app.json). An
update only reaches APKs with the same version. **Whenever a native change
needs a new APK, raise the version first** (1.0.0 → 1.0.1), then build; old
APKs keep getting updates for their own version until people install the new
one. (A native-code "fingerprint" was tried first, but it came out different
on Windows and on EAS's servers, which broke builds.)

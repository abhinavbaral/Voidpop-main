# Voidation

**Anime and manga tracker with live countdowns to the next episode.** A website and an
Android app, built from one codebase. No sign-up and no API keys: open it and use it.

- **Schedule:** a live countdown for every airing anime you follow, plus everything
  airing this week, grouped by day in your own time zone
- **Track** anime (Watching / Completed / Plan to Watch / On Hold / Dropped) and manga
  (Reading / Finished / Plan to Read …), including manhwa, manhua and donghua
- **Your verdict** instead of a number: Peak / Dive In / One Time / Void It, plus up to
  three vibes, shareable as an image card
- **Explore, Browse and Search** by origin (Japan, Korea, China), season, year and popularity
- **Tiers** that grow with what you complete, from Rookie to Addicted
- **History:** episodes that aired in the last 14 days for everything you follow
- **More:** statistics, appearance, settings (24-hour clock, countdown badges), data and storage, help, about
- **Progress:** episodes watched / chapters read on every title, +1 from the Library, "Mark watched" in History,
  "2 new" when you're behind; marking the last episode asks for your verdict
- **Import from AniList** by username (public lists, no key); a title in both keeps whichever copy changed last
- **Library search and sort** (recently updated, A–Z, airing soonest, most to catch up)
- **Delayed label** when a followed show's next episode moves later, with the original date
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
voidation/
├── app/      Android + iOS app — Expo / React Native
├── web/      Website — React + Vite
└── shared/   Everything both products must agree on, written once:
              the AniList client, the on-device data layer, tiers,
              verdicts, countdown formatting, demo data
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
```

## Where your data lives

There are no accounts. The library is one JSON document on your device: `localStorage`
in the browser, `AsyncStorage` on the phone (`shared/backend/storage.js`). The Me page
exports it as a backup file and restores it. Because every screen reads and writes
through `shared/backend/store.js`, adding real accounts later means replacing that one
file, not every screen.

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

Voidation started as a fork of VoidPop, my larger pop-culture tracker. It keeps only the
anime and manga side, with the social feed, accounts and the movie and web-series
sections taken out, and adds the airing countdowns.

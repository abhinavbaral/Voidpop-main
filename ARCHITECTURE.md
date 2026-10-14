# Voidation — how the code is organised

One rule holds everything together: **logic lives in `shared/`, screens live
in `app/` (and `web/`)**. A screen asks `shared/` for data and draws it; it
never talks to AniList or storage directly. That keeps the logic testable
without a phone, and lets VoidPop reuse it later.

```
app/                         Android + iOS app (Expo / React Native)
  index.js                   entry: registers the app, the widget, the background job
  App.js                     thin root: providers + navigation container
  assets/                    icon, brand/ (logos), voidmon/ (mascot poses), app-icons/
  scripts/                   voidmon-art.mjs remakes the mascot PNGs from the SVGs
  src/
    bootstrap/               init.js: plugs AsyncStorage + network state into shared (runs first)
    navigation/              RootNavigator (stack), MainTabs, linking (deep links), navRef
    hooks/                   useInitialRoute (Welcome or Main), useBackgroundChores
    context/                 ThemeContext
    screens/                 one folder per area, one file per screen
      explore/               Explore, Browse, Search, Season, Trends
      library/               Library
      schedule/              Schedule, History
      title/                 Detail, Person
      more/                  More, MorePage (statistics, settings, data, help, about…)
      welcome/               Welcome (cover wall + swipe), Onboarding
    components/              grouped by where they are used
      ui/                    Icon, Card, PosterRow, Chips, Skeleton, OfflineBanner… (used everywhere)
      brand/                 Brand (logo), Voidmon (mascot), AnimatedBanner
      title/                 pieces of a title page: CastCrew, EpisodeList, VerdictModal…
      library/               LibraryCard, YourShows, AniListSync, RankUp
      explore/               Billboard, ExploreCards, OutThisWeek, PickForMe
      share/                 countdown and verdict share cards
      welcome/               CoverWall, SwipeButton
    services/                phone-only work: backups, episode alerts, calendar, background job, welcome covers
    utils/                   nav (openDetail…), layout
    widget/                  Android home-screen widget

shared/                      everything that isn't drawing (plain JavaScript, no UI)
  api/                       AniList client (queries, cache, rate limits): the only file that talks to the network
  backend/                   store.js (library, verdicts, notes, stats…), storage adapter, contexts
  sync/                      two-way AniList sync
  features/                  one file per feature: explore, upcoming, seasonChart, earlierSeasons,
                             achievements, announced, awards, excited, peopleStats, readLinks,
                             malImport, calendarPlan, voidmon
  lib/                       small pure helpers: format, color, filters, theme, iconPaths, useNow
  demo/                      fake API + data for demo builds (same exports as api/)
  test/                      automated tests (node:test), run with `npm test`

web/                         website (React + Vite), kept locally, frozen
```

## Layers

| Layer | May use | Must not |
|---|---|---|
| Screens / components | `shared/*`, other components, `services/` | call `fetch`, read storage |
| `app/src/services/` | `shared/*`, Expo modules | draw UI |
| Feature logic (`shared/features`) | `api/`, `backend/store.js`, `lib/` | import React Native or DOM |
| `backend/store.js` | `backend/storage.js` | call AniList |
| `api/anilist.js` | `api/cache.js`, `fetch` | touch your library |

## Where does a new file go?

- **Draws something used by one area** (title page, library…): `components/<area>/`.
- **Draws something used everywhere:** `components/ui/`.
- **A whole page:** `screens/<area>/XScreen.js`, then register it in `navigation/RootNavigator.js`.
- **Rules about anime, manga, the library or countdowns:** `shared/features/`.
- **Needs the phone (notifications, files, calendar, background):** `app/src/services/`.
- **A new AniList query:** `shared/api/anilist.js`, plus the same export in `shared/demo/api-anilist.js`.

## Conventions

- **Every AniList field goes through `normalize()`** in `api/anilist.js`, so
  screens always get the same item shape.
- **Every data change goes through `store.js`** (so sync, the watch log, the
  widget and alerts all hear about it via `onDataChange`).
- **The demo API must export the same names** as `api/anilist.js`.
  `shared/api/anilist.js` and `shared/backend/storage.js` keep their paths: the
  demo builds (`metro.config.js`, `web/vite.config.js`) swap those two files.
- **No emoji in the UI** — icons come from `shared/lib/iconPaths.js`.
- **First launch:** `hooks/useInitialRoute` opens Welcome until `setOnboarded()` has
  run, then Main. Welcome → Onboarding uses `navigation.replace`, so finishing
  Onboarding resets to Main (first run) or goes back to More (the tour).
- **Voidmon, the mascot,** lives in `app/assets/voidmon/`: an `.svg` drawing of
  each pose (the design source) and the `.png` the app and website show.
  After editing a drawing, `node app/scripts/voidmon-art.mjs` remakes the PNGs.
  `shared/features/voidmon.js` lists the poses. Skeletons stay for anything with a
  layout; `VoidmonLoading` is only for waits with nothing to lay out.
- Plain JavaScript, `.js` for every file (JSX included), double quotes and semicolons.
- Comments explain *why*, in plain words.

## Checks

```
npm run lint      # ESLint (errors fail; warnings are hints)
npm test          # shared-logic tests
npm run check     # both
npm run check:app # bundles the Android app to catch broken imports
```

GitHub Actions (`.github/workflows/ci.yml`) runs lint, tests and the app
bundle on every push.

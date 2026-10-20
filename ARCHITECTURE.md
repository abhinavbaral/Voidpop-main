# VoidPop — how the code is organised

One rule holds everything together: **logic lives in `shared/`, screens live
in `app/` (and `web/`)**. A screen asks `shared/` for data and draws it; it
never talks to AniList or storage directly. That keeps the logic testable
without a phone, and lets the website reuse it.

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
  api/                       AniList client (queries, cache, rate limits) and TMDB client (movies & series): the only files that talk to the network
  backend/                   store.js (library, verdicts, notes, stats…), storage adapter, contexts
  sync/                      two-way AniList sync
  features/                  one file per feature: explore, upcoming, seasonChart, earlierSeasons,
                             achievements, announced, awards, excited, peopleStats, readLinks,
                             malImport, calendarPlan, voidmon, cinema, verdictMeter
  lib/                       small pure helpers: format, color, filters, theme, iconPaths, useNow
  demo/                      fake API + data for demo builds (same exports as api/)
  test/                      automated tests (node:test), run with `npm test`

web/                         website (React + Vite)
server/                      backend (Node, no dependencies): accounts, verdicts, comments, cloud backup
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

## Movies & TV

Movies and series are a separate shelf, on purpose. `store.js` keeps them under `cinema`
(`{ "movie:123" | "tv:456" -> { item, status: plan|watched, review } }`), apart from `library`:
they have no episodes to count, so they stay out of AniList sync, ranks, anime stats and the
Schedule. The same Void Verdicts and moods are used. `api/tmdb.js` answers from
`demo/cinema.js` when no key is set. `features/verdictMeter.js` is the community split
(hidden under 20 verdicts; counts only people who finished or dropped it). There is no real
community data until accounts exist, so the UI labels anything it shows as sample data.
Backups include the shelf (older backups without it still restore).

## Accounts and community (optional)

`server/` is a small HTTP API on Node's built-in SQLite. `shared/api/community.js` is the only client code
that talks to it; with no server address configured every community feature hides and the app behaves as
before. The login token is kept in the same on-device storage as the library. `shared/backend/useCommunity.js`
has the React hooks (`useAccount`, `useTitleVerdicts`, `useComments`) used by both the website and the app.
Your library is saved on the device first; sharing a verdict and posting comments go to the server afterwards
and fail quietly offline. Comments replaced the old private per-title note (`store.js` still reads old notes for
the Markdown export). The server is documented in `server/README.md`.

## Conventions

- **Some names still say "voidation" on purpose.** Saved-data keys (`voidation:*`,
  `voidation_theme`…), the Android package `com.voidation.app`, the Expo slug and the
  `voidation://auth` sign-in redirect keep the old name. Renaming them would wipe the
  data on people's phones, make Android treat the app as a new one, or break sync
  sign-in. The `voidpop://` link scheme works alongside `voidation://`.

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

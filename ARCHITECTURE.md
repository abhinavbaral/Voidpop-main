# Voidation — how the code is organised

One rule holds everything together: **logic lives in `shared/`, screens live
in `app/` (and `web/`)**. A screen asks `shared/` for data and draws it; it
never talks to AniList or storage directly. That keeps the logic testable
without a phone, and lets VoidPop reuse it later.

```
app/            Android app (Expo / React Native)
  App.js        navigation: tabs + stack screens
  src/screens/  one file per screen (Explore, Library, Detail, Person…)
  src/components/  reusable pieces (Card, PosterRow, CastCrew, Icon…)
  src/lib/      phone-only work: alerts, backups, calendar, background job
  src/widget/   home-screen widget
shared/         everything that isn't drawing (plain JavaScript, no UI)
  api/          AniList client (queries, cache, rate limits) — the only
                file that talks to the network
  backend/      store.js (your library, verdicts, notes, stats…) and the
                storage adapter — the only place that reads/writes data
  sync/         two-way AniList sync
  explore.js, upcoming.js, seasons.js, wrapped.js, …  feature logic
  format.js, color.js, filters.js  small pure helpers
  demo/         fake API + data for demo builds (same exports as api/)
  test/         automated tests (node:test), run with `npm test`
web/            website (React + Vite), kept locally, frozen
```

## Layers

| Layer | May use | Must not |
|---|---|---|
| Screens / components | `shared/*`, other components | call `fetch`, read storage |
| Feature logic (`shared/*.js`) | `api/`, `backend/store.js` | import React Native or DOM |
| `backend/store.js` | `backend/storage.js` | call AniList |
| `api/anilist.js` | `api/cache.js`, `fetch` | touch your library |

## Conventions

- **Every AniList field goes through `normalize()`** in `api/anilist.js`, so
  screens always get the same item shape.
- **Every data change goes through `store.js`** (so sync, the watch log, the
  widget and alerts all hear about it via `onDataChange`).
- **The demo API must export the same names** as `api/anilist.js`.
- **No emoji in the UI** — icons come from `shared/iconPaths.js`.
- **Voidmon, the mascot,** lives in `app/assets/voidmon/`: an `.svg` drawing of
  each pose (the design source) and the `.png` the app and website show.
  After editing a drawing, `node app/scripts/voidmon-art.mjs` remakes the PNGs.
  `shared/voidmon.js` lists the poses. Skeletons stay for anything with a
  layout; `VoidmonLoading` is only for waits with nothing to lay out.
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

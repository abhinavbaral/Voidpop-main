# VoidPop — mobile app (`app/`)

Expo React Native app for Android and iOS. Uses the shared logic in `../shared`.

```sh
npm run start      # from this folder (or `npm run app` from the repo root)
npm run demo       # offline, sample library
eas build -p android --profile preview   # installable .apk (see eas.json)
```

- `App.js`: thin root (providers + navigation container)
- `src/navigation/`: the five tabs (Explore, Library, History, Schedule, More) and the stack for titles, search, welcome and the More pages
- `src/bootstrap/init.js`: plugs the phone's `AsyncStorage` into the shared data layer, plus the optional TMDB key and VoidPop server address
- `src/screens/<area>/`, `src/components/<area>/`: React Native UI
- `src/services/`: phone-only work (backups, alerts, calendar, background job)

The full map is in [../ARCHITECTURE.md](../ARCHITECTURE.md).

Everything else (the library, tiers, the AniList client, countdown formatting) is
imported from `@voidpop/shared`.

Optional settings in `app/.env` (all `EXPO_PUBLIC_…`): `TMDB_API_KEY` and `TMDB_REGION` for live movies and series,
`VOIDPOP_API` for accounts, comments and community verdicts, `ANILIST_CLIENT_ID` for AniList sync.
Explore has a switch: Home, Anime (JP/KR/CN), Manga (manga/manhwa/manhua), Novel (light/web) and Movies & TV (`src/components/explore/CategoryFeed.js`, `CinemaFeed.js`). The title page for movies and series is in `src/screens/cinema/`; the community screens live in `src/screens/account/` and `src/components/community/`.
Note: these were written without a device or emulator to test on, so run `npm run check:app` and try them on your phone.

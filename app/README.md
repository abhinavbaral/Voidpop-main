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


## Void AI (Android)

See `../VOID_AI_SETUP.md` for setup and build instructions. Void AI's generative on-device model requires a custom Android build and a compatible `.litertlm` file; Expo Go uses the offline Local Quick Mode only.

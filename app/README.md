# Voidation — mobile app (`app/`)

Expo React Native app for Android and iOS. Uses the shared logic in `../shared`.

```sh
npm run start      # from this folder (or `npm run app` from the repo root)
npm run demo       # offline, sample library
eas build -p android --profile preview   # installable .apk (see eas.json)
```

- `App.js`: navigation (bottom tabs Explore / Library / Browse / History / Schedule / More + a stack for titles, search and the More pages)
- `src/backend/init.js`: plugs the phone's `AsyncStorage` into the shared data layer
- `src/screens/`, `src/components/`: React Native UI

Everything else (the library, tiers, the AniList client, countdown formatting) is
imported from `@voidation/shared`.

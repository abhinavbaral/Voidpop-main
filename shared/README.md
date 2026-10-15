# `@voidpop/shared`

Plain JavaScript used by both the app and the website: no React Native, no DOM.

| Folder / file | What |
|---|---|
| `api/anilist.js` | The only code that talks to AniList: lists, details, the airing schedule, next episodes, welcome-screen covers |
| `api/cache.js` | Size-capped offline cache and the online/offline flag for those answers |
| `backend/storage.js` | Where data lives: each platform plugs in `localStorage` or `AsyncStorage` |
| `backend/store.js` | Library, verdicts, Excited list, tiers, backup/restore: every read and write |
| `backend/SettingsContext.js`, `AuthContext.js` | Saved settings; the single local user (no accounts) |
| `sync/anilist.js` | Two-way AniList sync (status and progress) |
| `features/` | One file per feature: `explore`, `upcoming`, `seasonChart`, `earlierSeasons`, `achievements`, `announced`, `awards`, `excited`, `peopleStats`, `readLinks`, `malImport`, `calendarPlan`, `voidmon` |
| `lib/` | Small pure helpers: `format`, `color`, `filters`, `theme`, `iconPaths`, `useNow` |
| `demo/` | Sample catalog, sample library and a demo AniList client for offline mode |
| `test/` | Automated tests, run with `npm test` |

Rule of thumb: if the app and the website must agree on it, it goes here.

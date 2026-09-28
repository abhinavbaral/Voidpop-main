# `@voidation/shared`

Plain JavaScript used by both the app and the website: no React Native, no DOM.

| File | What |
|---|---|
| `backend/storage.js` | Where data lives: each platform plugs in `localStorage` or `AsyncStorage` |
| `backend/store.js` | Library, verdicts, Excited list, tiers, backup/restore: every read and write |
| `backend/SettingsContext.js` | 24-hour clock + countdown-badge settings, saved on the device |
| `backend/AuthContext.js` | The single local user (no accounts); keeps `useAuth()` for a future sign-in |
| `api/anilist.js` | Anime & manga: lists, details, the week's airing schedule, next episodes |
| `explore.js` | Home sections + daily picks |
| `format.js` | Release-date labels, countdowns, schedule day labels |
| `hooks/useNow.js` | A ticking clock for live countdowns (one timer per screen) |
| `theme.js` | Void / Light palettes |
| `demo/` | Sample catalog, sample library and a demo AniList client for offline mode |

Rule of thumb: if the app and the website must agree on it, it goes here.

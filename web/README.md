# Voidation — website (`web/`)

React + Vite. Same features and the same shared logic as the mobile app, via `../shared`.

```sh
npm run dev            # http://localhost:5173
npm run demo           # offline, sample library
npm run build          # → dist/ (deployed on Vercel, see ../vercel.json)
npm run build:preview  # single-file demo build (memory router, inlined assets)
```

- `src/init.js`: plugs this browser's `localStorage` into the shared data layer
- `src/App.jsx`: routes; every page has a real URL (`/title/anime/16498`, `/schedule`, `/browse?type=manga&origin=KR`)
- `src/pages/`, `src/components/`: React DOM UI
- `src/styles.css`: layout; colours come from the shared Void/Light palettes (`src/theme.jsx`)

Desktop (≥900px) gets a top navigation bar; phone browsers get the app-style bottom tabs.

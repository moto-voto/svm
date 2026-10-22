# Seasonvar Mobile UI (SolidJS)

This folder is the SolidJS single-page app, served by Express at `/solid`.
It is a rewrite of the server-rendered EJS views. The EJS views are kept
unchanged while the migration is in progress.

Migrated views:

- `src/views/index.ejs` -> `pages/SearchPage.jsx`
- `src/views/player.ejs` -> `pages/PlayerPage.jsx`
- `src/views/series-details.ejs` -> `pages/SeriesDetailsPage.jsx`

Note: `src/views/series.ejs` is not referenced by `src/server.js` (dead view),
so it was not migrated.

## Tooling decision

**Use Vite + `vite-plugin-solid`.** Do not build Solid with a bare bundler.

- Solid's fine-grained reactivity is produced at compile time by
  `babel-preset-solid`. `vite-plugin-solid` wires that Babel preset (plus
  `solid-refresh` HMR) in for us.
- Plain esbuild / Oxc / SWC have only a generic (React-style) JSX transform and
  do not produce idiomatic Solid output. If a non-Vite bundler is ever needed,
  it must still run `babel-preset-solid` (e.g. `esbuild-plugin-solid`).
- Vite is the official/first-party path used by the Solid docs and templates.

## Commands

```bash
npm run build:ui   # production build -> src/ui/dist (served at /solid)
npm run dev:ui     # Vite dev server with HMR
npm start          # Express; /solid serves the built app
```

Run `npm run build:ui` after changing anything under `src/ui` before starting
the server, otherwise `/solid` serves a stale bundle.

## Routes (client-side, under the `/solid` base)

| Route             | Page                | Backend API                 |
| ----------------- | ------------------- | --------------------------- |
| `/solid/`         | SearchPage          | `/api/search?q=`            |
| `/solid/series`   | PlayerPage          | `/api/series?url=`          |
| `/solid/series-details` | SeriesDetailsPage | `/api/series-details?url=` |

Express serves `dist/index.html` for any unknown `/solid/*` path so the client
router can resolve deep links.

## Layout

```
src/ui/
├── index.html                  # Vite entry (Tailwind, FontAwesome, Inter)
├── index.jsx                   # Router setup (base="/solid")
├── api.js                      # backend client
├── styles.css                  # global styles (search page / shared)
├── pages/
│   ├── SearchPage.jsx          # virtualized poster grid
│   ├── PlayerPage.jsx          # MX-Player style video player
│   ├── SeriesDetailsPage.jsx   # series details card
│   └── player.css              # player-specific styles
└── components/
    ├── Header.jsx              # header, search form, live stats
    └── VirtualGrid.jsx         # virtualized/windowed poster grid
```

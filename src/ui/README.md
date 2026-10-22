# Seasonvar Mobile UI (SolidJS)

This folder is the SolidJS single-page app, served by Express at the site root.
It replaces the former server-rendered EJS views (`src/views` has been removed).

Pages:

- `pages/SearchPage.jsx` — virtualized poster grid (formerly `index.ejs`)
- `pages/PlayerPage.jsx` — MX-Player style video player (formerly `player.ejs`)
- `pages/SeriesDetailsPage.jsx` — series details card (formerly `series-details.ejs`)

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
npm run build:ui   # production build -> src/ui/dist (served at the root)
npm run dev:ui     # Vite dev server with HMR
npm start          # builds the UI (prestart) then runs Express

npm test           # run all unit tests (node:test)
npm run test:be    # backend tests only
npm run test:fe    # frontend tests only
```

## Tests

Unit tests use the built-in Node.js test runner (`node:test`) and live under
`tests/`, split into `tests/be` and `tests/fe`. No extra test dependencies.

- `tests/be` — parser and API modules (`src/parser`, `src/api`, `src/common.js`)
  with fixtures and a small `fetch` stub.
- `tests/fe` — pure frontend modules: `src/ui/api.js`, `src/ui/utils.js` and
  `src/ui/grid-layout.js` (the virtualized-grid math).

Note: Solid *component* tests would require a DOM environment plus a JSX
transform (e.g. `@solidjs/testing-library` + `happy-dom`), so frontend logic is
kept in dependency-free modules and unit tested directly. Browser-dependent
component behaviour is covered by the production build and manual checks.


## Routes (client-side)

| Route              | Page                | Backend API                 |
| ------------------ | ------------------- | --------------------------- |
| `/`                | SearchPage          | `/api/search?q=`            |
| `/series`          | PlayerPage          | `/api/series?url=`          |
| `/series-details`  | SeriesDetailsPage   | `/api/series-details?url=`  |

Express serves `dist/index.html` for any unknown path so the client router can
resolve deep links.

## Layout

```
src/ui/
├── index.html                  # Vite entry (Tailwind, FontAwesome, Inter)
├── index.jsx                   # Router setup
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
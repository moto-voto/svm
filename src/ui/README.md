# Seasonvar Mobile UI (SolidJS)

This folder is the SolidJS single-page app, served by Express at `/solid`.
It is a rewrite of the server-rendered `src/views/index.ejs`. The EJS view is
kept unchanged for now.

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

## Layout

```
src/ui/
├── index.html              # Vite entry HTML (Tailwind CDN + #root)
├── index.jsx               # render() bootstrap
├── App.jsx                 # top-level state + data loading
├── api.js                  # backend client (/api/search)
├── styles.css              # custom styles ported from index.ejs
├── vite.config.js          # root=src/ui, base=/solid/, outDir=dist
└── components/
    ├── Header.jsx          # header, search form, live stats
    └── VirtualGrid.jsx     # virtualized/windowed poster grid
```

## Notes

- Data is fetched client-side from the existing `/api/search` endpoint;
  `?q=` is read on load and kept in the URL on search.
- Tailwind is loaded from the same CDN as `index.ejs` so styling stays in sync.

# Seasonvar Mobile UI (SolidJS)

This folder is the SolidJS single-page app. It is built to static files
(`dist/public`) which the Node server serves directly (with a SPA fallback),
and which can also be served by nginx while the API is proxied. The deployment
prefix is **detected at runtime**, so the same build can be hosted at the root
(`/`) or under any prefix (`/svm`, `/foo/bar`, ...).
It replaces the former server-rendered EJS views (`src/views` has been removed).

Pages:

- `pages/SearchPage.jsx` — virtualized poster grid (formerly `index.ejs`); keeps
  `?q=` in the URL and restores the last search (in-memory, survives client-side
  navigation) without a new request when returning from `SeriesDetailsPage`,
  including the scroll position in the grid (viewport anchor, see `anchorFor` in
  `grid-layout.js`); a reload intentionally starts fresh — the URL query is the
  durable state; the header offers a link to the watch-history page
- `pages/HistoryPage.jsx` — the watch-history view: the same virtualized poster
  grid, but the tiles come from the IndexedDB watch-history store instead of a
  backend search. Sorted most-recently-watched first, filterable with the same
  search box ("Поиск в истории..."), and each tile shows the last watched
  season/episode as S01/E05 badges in the cover corners. Tiles link to the
  series details exactly like search results
- `pages/PlayerPage.jsx` — MX-Player style video player (formerly `player.ejs`);
  records the last watch point (season/episode numbers + metadata passed via the
  player URL) into the watch-history store so the History page needs no backend
  requests
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
npm run build:fe   # production frontend build -> dist/public
npm run build:be   # self-contained server build -> dist/svm.js
npm run dev:fe     # Vite dev server with HMR
npm run dev:be     # run the Express server from source
npm start          # build:fe + build:be, then node dist/svm.js

npm test           # run all unit tests (node:test)
npm run test:be    # backend tests only
npm run test:fe    # frontend tests only
```

## Self-contained server build (`node svm.js`)

`npm run build:be` produces a **single file**, `dist/svm.js`, that contains the
server plus all of its Node dependencies (express, cheerio, ...). It needs no
`node_modules`. The UI is **not embedded** in the bundle: the server keeps
serving the SPA from disk (`dist/public`), so build the frontend next to it:

```bash
npm run build:fe          # -> dist/public
npm run build:be          # -> dist/svm.js (bundles server + node_modules)
node dist/svm.js          # serves the SPA from dist/public and /api/*
```

The deployed folder is just the build output:

```
dist/
  svm.js        # self-contained server (no node_modules needed)
  public/       # frontend build (index.html + assets)
```

How it works:

- `vite.config.be.js` sets `ssr.noExternal: true`, so every server-side
  dependency is inlined into the output. Node built-ins stay external.
- `src/server.js` is unchanged: it serves the SPA from
  `join(__dirname, '..', 'dist', 'public')` (which resolves to `dist/public`
  next to `svm.js`), with `express.static` and a SPA fallback, plus the API.
- The server does not embed the UI, so build order is not critical;
  `dist/public` just has to exist at runtime.

> **Troubleshooting `ERR_MODULE_NOT_FOUND: Cannot find package 'express'`** —
> the `svm.js` you ran is an old/unbundled artifact. Rebuild with
> `npm run build:be` and copy the fresh `dist/svm.js` (and `dist/public`).
> Check it with `grep -c '"express"' dist/svm.js` (must be `0`).

## Hosting under a prefix (`/svm`, ...)

The prefix is not known at build time, so the production build is
prefix-agnostic:

- Vite builds with a **relative base** (`base: './'`), so `index.html`
  references `./assets/...`. The browser resolves those against whatever URL
  the SPA was served from (root or any prefix).
- At startup the app derives the real prefix from the URL of the entry module
  (`import.meta.url`): the bundle always lives at `<prefix>/assets/<file>.js`,
  so that directory minus `assets/` is the prefix. Dev modules served from
  `<prefix>/src/...` are handled the same way.

`src/ui/utils.js` exposes the result and everything else consumes it:

- `BASE_URL` — `/svm/` (leading + trailing slash)
- `BASE_PATH` — `/svm` (no trailing slash, for the `<Router base>` prop)
- `withBase(path)` — `withBase('/api/x')` -> `/svm/api/x`

`src/ui/api.js` calls `withBase(...)` for every request, and internal links use
Solid Router's `<A>`, which prepends the router base itself.

### nginx example

Build once, then let nginx serve the static files and proxy the API. Note the
redirect from the bare prefix to its trailing-slash form: relative `./assets`
URLs only resolve correctly when the document URL ends with `/`.

```nginx
server {
    # Keep the SPA prefix stable; /svm -> /svm/ is required.
    location = /svm { return 301 /svm/; }

    location /svm/ {
        alias /var/www/svm/;          # dist/public contents
        try_files $uri $uri/ /svm/index.html;
    }

    # Strip the prefix before hitting the Node API server.
    location /svm/api/ {
        proxy_pass http://127.0.0.1:3000/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

With the config above nginx serves the SPA and the Node server handles the API
at the root (`node dist/svm.js`, no `BASE_PATH`). If you expose the server
directly instead, it serves both the SPA and the API; set `BASE_PATH` to put
everything under a prefix:

```bash
BASE_PATH=/svm node dist/svm.js   # API at http://host/svm/api
```

## Tests

Unit tests use the built-in Node.js test runner (`node:test`) and live under
`tests/`, split into `tests/be` and `tests/fe`. No extra test dependencies.

- `tests/be` — parser and API modules (`src/parser`, `src/api`, `src/common.js`)
  with fixtures and a small `fetch` stub.
- `tests/fe` — the dependency-free frontend modules:
  - `src/ui/api.js` (backend client)
  - `src/ui/api-cache.js` (per-URL TTL cache wrapper: raw-text storage, request dedup, never-cache-failures)
  - `src/ui/utils.js` (`clamp`, `normalizeQuery`, `cleanTitle`, `formatTime`, base-path helpers)
  - `src/ui/grid-layout.js` (virtualized-grid math + stats label)
  - `src/ui/gestures.js` (`resolveGesture` touch decision logic)
  - `src/ui/player.js` (progress/seek, tap/keyboard decisions, index helpers)
  - `src/ui/watch-progress.js` (IndexedDB watch-progress keys/resume/merge helpers
    **plus the watch-history store**: `saveWatchHistory`/`loadWatchHistory`,
    `sortHistoryByRecent`, `filterHistoryByQuery`, `buildHistoryTiles`,
    `padBadgeNumber`)
  - `src/ui/series-details.js` (poster/rating/label formatting)
  - `src/ui/search-state.js` (in-memory last-search store + restore/no-refetch decision)
  - `src/ui/history-state.js` (in-memory last-history listing store + restore/no-refetch decision)

Note: Solid *component* tests would require a DOM environment plus a JSX
transform (e.g. `@solidjs/testing-library` + `happy-dom`), so frontend logic is
kept in dependency-free modules and unit tested directly. Browser-dependent
component behaviour is covered by the production build and manual checks.


## Routes (client-side)

| Route              | Page                | Backend API                 |
| ------------------ | ------------------- | --------------------------- |
| `/`                | SearchPage          | `/api/search?q=`            |
| `/history`         | HistoryPage         | none (IndexedDB watch history) |
| `/series`          | PlayerPage          | `/api/series?url=`          |
| `/series-details`  | SeriesDetailsPage   | `/api/series-details?url=`  |

The static host must serve `dist/public/index.html` for any unknown path
(e.g. nginx `try_files $uri $uri/ /svm/index.html`) so the client router can
resolve deep links.

## Layout

```
src/ui/
├── index.html                  # Vite entry (Tailwind, FontAwesome, Inter)
├── index.jsx                   # Router setup
├── api.js                      # backend client (all calls via the API cache)
├── api-cache.js                # per-URL in-memory API cache (raw-text, TTL, dedup)
├── utils.js                    # clamp, normalizeQuery, cleanTitle, formatTime, BASE_PATH/withBase
├── gestures.js                 # resolveGesture (touch decision logic)
├── player.js                   # player display/index/keyboard/tap helpers
├── watch-progress.js            # IndexedDB watch-progress + watch-history persistence
├── series-details.js           # series-details display helpers
├── search-state.js             # in-memory search state (back-nav restore)
├── history-state.js            # in-memory history-listing state (back-nav restore)
├── grid-layout.js              # virtualized-grid layout math
├── styles.css                  # global styles (search page / shared)
├── pages/
│   ├── SearchPage.jsx          # virtualized poster grid
│   ├── HistoryPage.jsx         # watch-history poster grid (IndexedDB-backed)
│   ├── PlayerPage.jsx          # MX-Player style video player
│   ├── SeriesDetailsPage.jsx   # series details card
│   └── player.css              # player-specific styles
└── components/
    ├── Header.jsx              # unified header (brand, optional stats + search)
    └── VirtualGrid.jsx         # virtualized/windowed poster grid
```

## Why logic lives in plain `.js` modules

Component behaviour is hard to unit test without a DOM harness, so decision
logic and math are extracted into dependency-free modules under `src/ui/*.js`
and covered by the standard `node:test` suite. This keeps bug fixes cheap to
lock down (e.g. the "panel scroll must not seek the video" regression is a
plain assertion in `tests/fe/gestures.test.js`).
# Seasonvar Mobile UI (SolidJS)

This folder is the SolidJS single-page app, served by Express or directly by
nginx. The deployment prefix is **detected at runtime**, so the same build can
be hosted at the root (`/`) or under any prefix (`/svm`, `/foo/bar`, ...).
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

With the config above the Node server runs at the root (`node dist/svm.js`,
no `BASE_PATH`). If the Node server is exposed directly and hosts the SPA
itself, set `BASE_PATH` so it mounts API + static + SPA fallback under the
prefix and redirects the bare prefix:

```bash
BASE_PATH=/svm node dist/svm.js   # http://host/svm/
```

## Tests

Unit tests use the built-in Node.js test runner (`node:test`) and live under
`tests/`, split into `tests/be` and `tests/fe`. No extra test dependencies.

- `tests/be` — parser and API modules (`src/parser`, `src/api`, `src/common.js`)
  with fixtures and a small `fetch` stub.
- `tests/fe` — the dependency-free frontend modules:
  - `src/ui/api.js` (backend client)
  - `src/ui/utils.js` (`clamp`, `normalizeQuery`, `cleanTitle`, `formatTime`, base-path helpers)
  - `src/ui/grid-layout.js` (virtualized-grid math + stats label)
  - `src/ui/gestures.js` (`resolveGesture` touch decision logic)
  - `src/ui/player.js` (progress/seek, tap/keyboard decisions, index helpers)
  - `src/ui/watch-progress.js` (IndexedDB watch-progress keys/resume/merge helpers)
  - `src/ui/series-details.js` (poster/rating/label formatting)

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
├── utils.js                    # clamp, normalizeQuery, cleanTitle, formatTime, BASE_PATH/withBase
├── gestures.js                 # resolveGesture (touch decision logic)
├── player.js                   # player display/index/keyboard/tap helpers
├── watch-progress.js            # IndexedDB watch-progress persistence
├── series-details.js           # series-details display helpers
├── grid-layout.js              # virtualized-grid layout math
├── styles.css                  # global styles (search page / shared)
├── pages/
│   ├── SearchPage.jsx          # virtualized poster grid
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
# Rust backend (`src/srv`)

Rust port of the Node backend (`src/server.js` + `src/api/*` + `src/parser/*`):

- **axum** replaces Express
- **scrape-core** replaces cheerio (arena DOM + CSS selectors, pre-compiled
  selector statics)
- **reqwest** (rustls, HTTP/1.1) replaces `fetch`

One static binary, no runtime dependencies beyond the OS. The goal is a
minimal memory footprint with maximum speed: no regex engine (all JS regex
semantics are hand-rolled in `text.rs`), HTML parsed once per request and
shared between parsers, pooled upstream connections, per-request DOM dropped
as soon as the response is produced.

## Layout

```
src/srv/
├── Cargo.toml
└── src/
    ├── main.rs            # startup: env, UI dir resolution, bind, serve
    ├── server.rs          # router + API handlers (port of server.js)
    ├── static_files.rs    # express.static + SPA fallback replacement
    ├── api.rs             # ports of src/api/*.js
    ├── http.rs            # shared upstream HTTP client
    ├── common.rs          # TARGET, upstream headers, log() (common.js)
    ├── text.rs            # JS-regex-equivalent string helpers (no regex dep)
    ├── models.rs          # JSON response shapes (serde)
    └── parser/            # 1:1 ports of src/parser/*
        ├── search.rs          # parseSearchResults
        ├── default_list.rs    # parseDefaultList
        ├── series.rs          # parseSeries
        ├── series_details.rs  # parseSeriesDetails
        └── playlists.rs       # parsePlaylistTranslations / fetchPlaylist
```

## Build & run

```bash
cd src/srv
cargo build --release            # -> src/srv/target/release/svm-server
cargo test                       # offline unit tests (ports tests/be fixtures)
./target/release/svm-server      # http://localhost:3000
```

Like the Node server, the UI is served from disk, not embedded: the binary
looks for `dist/public` next to the executable's parent directory
(`<exe>/../dist/public`, i.e. drop the binary into `dist/` next to
`public/`), then relative to the CWD. Override with `UI_DIST`:

```bash
UI_DIST=../../dist/public ./target/release/svm-server
```

## Environment

| Variable    | Default | Meaning                                                    |
| ----------- | ------- | ---------------------------------------------------------- |
| `PORT`      | `3000`  | listen port (binds `0.0.0.0`)                              |
| `BASE_PATH` | `/`     | mount prefix (e.g. `/svm`), same semantics as the Node app |
| `UI_DIST`   | auto    | explicit path to the built SPA (`dist/public`)             |

## Endpoints (identical to the Node server)

| Route                          | Upstream                                   |
| ------------------------------ | ------------------------------------------ |
| `GET /api/search?q=`           | `/search?q=`, or the front page when empty |
| `GET /api/series-list`         | front page                                 |
| `GET /api/playlist?url=`       | series page + `plist/*.json`               |
| `GET /api/series?url=`         | series page + `plist/*.json`               |
| `GET /api/series-details?url=` | series page                                |

Behavior parity with the Express implementation:

- API failures return HTTP 200 with `{"error": "..."}` (same message
  prefixes), missing `url` params return `{"error": "Series URL is required"}`.
- Unknown paths serve `dist/public/index.html` (SPA fallback); `GET <BASE_PATH>`
  (no trailing slash) 301-redirects to `<BASE_PATH>/`.
- Static files get `Content-Type`, weak `ETag`, `Last-Modified`, and answer
  `If-None-Match` / `If-Modified-Since` with `304`.

## Deliberate differences

- The manual `Host` header from `common.js` is not sent; the client derives
  it from the URL (keeps third-party hosts reachable via `/api/playlist`).
- Upstream requests use HTTP/1.1 without compression negotiation — smaller
  buffers, less CPU; response bodies are decoded as UTF-8 like Node's.
- For the "first playlist key" fallback (`var pl` JSON with no matching
  `<li>` list), numeric keys are ordered numerically like JS does; with
  non-numeric keys the insertion order of the JSON object is approximated.

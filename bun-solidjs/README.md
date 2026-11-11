# bun-solidjs

Bun plugin + build script for SolidJS projects. Uses `babel-preset-solid` (the same compiler as `vite-plugin-solid`) — no project-specific assumptions.

## Quick start

```bash
# 1. Create bun.config.js in your project root (or use --config=)
cp bun-solidjs/bun.config.example.js bun.config.js

# 2. Edit bun.config.js to point to your HTML entry
# 3. Build
bun bun-solidjs/build.js
```

## How it works

The build script reads your HTML entry file and finds the module script:

```html
<script type="module" src="./index.jsx"></script>
<!-- or ./main.tsx, ./app.jsx — any path works -->
```

It bundles that entry point, then rewrites the HTML to point to the hashed output in `assets/`.

## Usage

```bash
bun bun-solidjs/build.js                          # auto-discover config
bun bun-solidjs/build.js --config=my.config.js    # explicit config file
bun bun-solidjs/build.js --no-stats               # skip file size stats
bun bun-solidjs/build.js --silent                 # no output at all
```

## Config resolution order

1. `--config=path/to/config.js` — CLI argument
2. `bun.config.js` — in current working directory
3. Built-in defaults: `entry: "index.html"`, `outDir: "dist"`

## Config syntax

```js
// bun.config.js
/** @type {import('./bun-solidjs/bun.config.d.ts').BunSolidConfig} */
import { resolve } from "path";

export default {
  // ── Required ──────────────────────────────────────────────
  entry: resolve("index.html"),   // HTML file with <script type="module" src="...">
  outDir: resolve("dist"),         // output directory (cleaned before build)

  // ── Optional ──────────────────────────────────────────────
  publicDir: resolve("public"),    // static assets copied to outDir root

  // Solid compiler options
  solid: {
    generate: "dom",               // "dom" (client) | "ssr" (server)
    hydratable: true,              // add hydration markers (for SSR)
    dev: false,                    // true = source maps + HMR refresh
  },

  // Bun.build() options
  build: {
    minify: true,                  // boolean | { whitespace, identifiers, syntax }
    splitting: true,               // code splitting for shared chunks
    target: "browser",             // "browser" | "bun" | "node"
    conditions: ["browser", "production"],  // package.json export conditions
    define: {                      // global replacements
      "process.env.NODE_ENV": '"production"',
    },
    naming: "[name]-[hash].[ext]", // output filename pattern
    external: [],                  // packages to exclude from bundle
  },
};
```

## Config reference

### `entry` (string, required)
Path to your HTML entry file. The JS/TS entry point is read from the `<script type="module" src="...">` tag inside it.

### `outDir` (string, required)
Output directory. Cleaned (deleted) before each build. HTML goes to root, JS/CSS to `outDir/assets/`.

### `publicDir` (string, optional)
Directory with static files (favicons, robots.txt, etc.). Copied to `outDir` root unchanged.

### `solid.generate` ("dom" | "ssr")
- `"dom"` — client-side rendering (default)
- `"ssr"` — server-side rendering output

### `solid.hydratable` (boolean)
Add hydration markers. Required for SSR hydration. Default: `true`.

### `solid.dev` (boolean)
Dev mode: enables source maps and injects Solid HMR refresh registration. Default: `false`.

### `build.minify` (boolean | object)
- `true` — full minification (whitespace + identifiers + syntax)
- `false` — no minification
- Object form: `{ whitespace: true, identifiers: true, syntax: true }`

### `build.splitting` (boolean)
Enable code splitting. Default: `true`.

### `build.target` ("browser" | "bun" | "node")
Build target. Default: `"browser"`.

### `build.conditions` (string[])
Custom export conditions for package.json `exports` field resolution. Useful for picking production builds: `["browser", "production"]`.

### `build.define` (Record<string, string>)
Global constant replacements, e.g. `{ "process.env.NODE_ENV": '"production"' }`.

### `build.naming` (string)
Output filename pattern. Placeholders: `[name]`, `[hash]`, `[ext]`. Default: `"[name]-[hash].[ext]"`.

### `build.external` (string[])
Packages to leave as external imports (not bundled).

## Output structure

```
dist/
├── index.html              # rewritten with hashed asset paths
├── assets/
│   ├── index-abc123.js     # bundled JS
│   └── index-def456.css    # extracted CSS
└── favicon.ico             # copied from publicDir
```

## Files

| File | Description |
|------|-------------|
| `build.js` | Production build script — reads config, parses HTML, runs Bun.build(), reports stats |
| `dev.js` | Dev server — serves files on the fly with Babel transform, API proxy |
| `bun-plugin-solid.js` | Bun plugin — Babel transform for .jsx/.tsx, CSS extraction, asset inlining |
| `bun.config.d.ts` | TypeScript types for the config file |
| `bun.config.example.js` | Example config to copy |

## Dev server

```bash
bun bun-solidjs/dev.js                        # auto-discover config, port 5173
bun bun-solidjs/dev.js --port=3000            # custom port
bun bun-solidjs/dev.js --config=my.config.js  # custom config
```

HMR is **component-level** via [`solid-refresh`](https://github.com/solidjs/solid-refresh) (add it to `devDependencies`): edited components hot-swap with state preserved. CSS changes hot-swap the `<link>` without a reload; anything else falls back to a full page reload. Bare imports are resolved with browser export conditions and served through the Babel transform; CSS `import`s are rewritten to `<link>` injection so the module graph never breaks.

## Plugin usage standalone

```js
import { build } from "bun";
import solidPlugin from "./bun-solidjs/bun-plugin-solid.js";

await build({
  entrypoints: ["src/main.jsx"],
  outdir: "dist",
  plugins: [solidPlugin({ generate: "dom", hydratable: true })],
});
```
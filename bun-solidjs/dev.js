#!/usr/bin/env bun
/**
 * Development server for SolidJS using bun-plugin-solid.
 *
 * Serves files on the fly with Babel transform (same as build).
 * HMR: basic (full page reload via solid-js/hmr registration).
 * For full component-level HMR with state preservation, use Vite dev server.
 *
 * Usage:
 *   bun bun-solidjs/dev.js                        # auto-discover config
 *   bun bun-solidjs/dev.js --config=my.config.js  # custom config
 *   bun bun-solidjs/dev.js --port=3000            # custom port
 */

import { serve } from "bun";
import { resolve, dirname, basename, join, extname } from "path";
import { existsSync, readFileSync, watch, readdirSync } from "fs";
import solidPluginImport from "./bun-plugin-solid.js";

const solidPlugin = solidPluginImport.default || solidPluginImport;

const DEFAULT_CONFIG = {
  entry: "index.html",
  outDir: "dist",
  publicDir: null,
  solid: { generate: "dom", hydratable: true, dev: true },
  server: { port: 5173, apiProxy: "http://localhost:3000" },
};

async function main() {
  const args = process.argv.slice(2);
  const configArg = args.find(a => a.startsWith("--config="));
  const portArg = args.find(a => a.startsWith("--port="));

  // Load config (same resolution as build.js)
  let config = DEFAULT_CONFIG;
  if (configArg) {
    config = { ...DEFAULT_CONFIG, ...(await import(resolve(configArg.split("=")[1]))).default };
  } else if (existsSync(resolve("bun.config.js"))) {
    config = { ...DEFAULT_CONFIG, ...(await import(resolve("bun.config.js"))).default };
  }
  config.solid = { ...DEFAULT_CONFIG.solid, ...config.solid, dev: true };
  config.server = { ...DEFAULT_CONFIG.server, ...config.server };

  const entryHtml = resolve(config.entry);
  const rootDir = dirname(entryHtml);
  const publicDir = config.publicDir ? resolve(config.publicDir) : null;
  const port = portArg ? parseInt(portArg.split("=")[1]) : config.server.port;
  const apiProxy = config.server.apiProxy;

  // ---- Component-level HMR (solid-refresh) + WebSocket + file watcher ----
  const wsClients = new Set();

  // Client runtime: emulates the `module.hot` / `import.meta.hot` API that
  // solid-refresh expects, re-imports changed modules with a cache-busting
  // query and runs their accept/dispose callbacks so components hot-swap
  // with state preserved.
  const HMR_CLIENT = `<script>(() => {
  const states = new Map();
  function createHot(url) {
    const key = String(url).split("?")[0];
    let st = states.get(key);
    if (!st) { st = { data: undefined, acceptCbs: [], disposeCbs: [] }; states.set(key, st); }
    return {
      get data() { return st.data; },
      accept(cb) { st.acceptCbs.push(cb || (() => {})); },
      dispose(cb) { st.disposeCbs.push(cb); },
      decline() { location.reload(); },
      invalidate() { location.reload(); },
    };
  }
  async function applyUpdate(path) {
    const key = path.split("?")[0];
    const st = states.get(key);
    if (!st) { location.reload(); return; }
    const data = {};
    for (const cb of st.disposeCbs) { try { cb(data); } catch (e) { console.error(e); } }
    st.data = data; st.acceptCbs = []; st.disposeCbs = [];
    try {
      const mod = await import(key + "?t=" + Date.now());
      for (const cb of st.acceptCbs) { try { cb(mod); } catch (e) { console.error(e); } }
    } catch (e) { console.error(e); location.reload(); }
  }
  function applyCss(path) {
    const t = Date.now();
    document.querySelectorAll('link[rel="stylesheet"]').forEach(l => {
      const u = new URL(l.href, location.href);
      if (u.pathname === path) { u.searchParams.set("t", t); l.href = u.pathname + u.search; }
    });
  }
  globalThis.__HMR__ = { createHot };
  const proto = location.protocol === "https:" ? "wss" : "ws";
  const ws = new WebSocket(proto + "://" + location.host);
  ws.onmessage = (e) => {
    try {
      const msg = JSON.parse(e.data);
      if (msg.type === "update") applyUpdate(msg.path);
      else if (msg.type === "css") applyCss(msg.path);
      else location.reload();
    } catch { location.reload(); }
  };
})();</script>`;

  function injectHmr(html) {
    return html.includes("</body>") ? html.replace("</body>", HMR_CLIENT + "</body>") : html + HMR_CLIENT;
  }

  let reloadTimer = null;
  function scheduleReload(filename) {
    clearTimeout(reloadTimer);
    reloadTimer = setTimeout(() => {
      // filename is relative to rootDir (recursive watch)
      const rel = String(filename || "").replace(/\\/g, "/");
      let msg;
      if (/\.css$/.test(rel)) msg = JSON.stringify({ type: "css", path: "/" + rel });
      else if (/\.[jt]sx?$/.test(rel)) msg = JSON.stringify({ type: "update", path: "/" + rel });
      else msg = JSON.stringify({ type: "reload" });
      for (const ws of wsClients) ws.send(msg);
    }, 100);
  }

  function watchTree(dir) {
    const onEvent = (_eventType, filename) => scheduleReload(filename);
    try {
      watch(dir, { recursive: true }, onEvent);
    } catch {
      // recursive watch unsupported: watch each entry individually
      watch(dir, onEvent);
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (entry.isDirectory()) watchTree(join(dir, entry.name));
      }
    }
  }
  watchTree(rootDir);

  if (!existsSync(entryHtml)) {
    console.error(`❌ Entry HTML not found: ${entryHtml}`);
    process.exit(1);
  }

  // Read entry point from HTML
  const htmlContent = readFileSync(entryHtml, "utf8");
  const scriptMatch = htmlContent.match(/<script[^>]*type=["']module["'][^>]*src=["']([^"']+)["']/);
  const entrySrc = scriptMatch ? scriptMatch[1].replace(/^[./]+/, "") : "index.jsx";

  // Babel transform for dev mode (with solid-refresh would go here for full HMR)
  const babel = require("@babel/core");
  const solidPreset = require("babel-preset-solid");
  const tsPreset = require("@babel/preset-typescript");
  const solidRefresh = require("solid-refresh/babel");

  // Resolve a bare specifier the way a browser bundler would: walk up
  // node_modules and pick the "browser" export condition (Bun.resolveSync
  // would pick the "node"/server build, e.g. solid-js/web → dist/server.js).
  const CONDITION_PRIORITY = ["browser", "development", "import", "module", "default", "require"];

  function pickCondition(target) {
    if (typeof target === "string") return target;
    if (target && typeof target === "object") {
      for (const cond of CONDITION_PRIORITY) {
        if (cond in target) {
          const picked = pickCondition(target[cond]);
          if (picked) return picked;
        }
      }
    }
    return null;
  }

  function resolveBrowser(spec, fromDir) {
    const parts = spec.split("/");
    const pkgName = spec.startsWith("@") ? parts.slice(0, 2).join("/") : parts[0];
    const subParts = parts.slice(spec.startsWith("@") ? 2 : 1);
    const subpath = subParts.length ? "./" + subParts.join("/") : ".";

    let dir = fromDir;
    while (true) {
      const pkgDir = join(dir, "node_modules", pkgName);
      const pkgJsonPath = join(pkgDir, "package.json");
      if (existsSync(pkgJsonPath)) {
        const pkg = JSON.parse(readFileSync(pkgJsonPath, "utf8"));
        let target = null;
        if (pkg.exports) {
          const exp = typeof pkg.exports === "string" ? { ".": pkg.exports } : pkg.exports;
          if (subpath in exp) {
            target = pickCondition(exp[subpath]);
          } else {
            // subpath pattern keys, e.g. "./*": "./dist/*"
            for (const key of Object.keys(exp)) {
              if (!key.includes("*")) continue;
              const [pre, post] = key.split("*");
              if (subpath.startsWith(pre) && subpath.endsWith(post)) {
                const matched = subpath.slice(pre.length, subpath.length - post.length);
                const t = pickCondition(exp[key]);
                target = typeof t === "string" ? t.replace("*", matched) : t;
                break;
              }
            }
          }
        }
        if (!target) {
          if (subpath === ".") target = pkg.browser || pkg.module || pkg.main || "index.js";
          else target = subpath.replace(/^\.\//, "");
        }
        const resolved = join(pkgDir, target);
        if (existsSync(resolved)) return resolved;
      }
      const parent = dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
    // Fallback to Bun's resolver
    return Bun.resolveSync(spec, fromDir);
  }

  // Browsers refuse to load CSS via `import` (MIME check), which kills the
  // whole module graph and leaves a white screen. Rewrite side-effect CSS
  // imports into a <link> injection instead.
  function rewriteCssImports(code) {
    return code.replace(
      /import\s*(["'])([^"']+\.css)\1\s*;?/g,
      (match, quote, spec) =>
        `(function(){var l=document.createElement("link");l.rel="stylesheet";l.href=${JSON.stringify(spec)};document.head.appendChild(l);})();`
    );
  }

  // Rewrite bare specifiers (e.g. "solid-js/web") to dev-server URLs so the
  // browser can load them. Resolved recursively with browser conditions.
  function rewriteBareImports(code, fromFile) {
    const fromDir = dirname(fromFile);
    return code.replace(
      /(from\s*|import\s*|export\s+[^'"]*?from\s*)(["'])([^"'.\/][^"']*|\.{0,2}\/[^"']*)\2/g,
      (match, prefix, quote, spec) => {
        if (spec.startsWith("./") || spec.startsWith("../") || spec.startsWith("/")) {
          return match; // relative/absolute: browser handles natively
        }
        try {
          const resolved = resolveBrowser(spec, fromDir);
          return `${prefix}${quote}/@bun?f=${encodeURIComponent(resolved)}${quote}`;
        } catch {
          return match; // leave as-is; will surface a clear browser error
        }
      }
    );
  }

  async function transformFile(filePath, urlPath) {
    const { readFile } = await import("node:fs/promises");
    const code = await readFile(filePath, "utf8");
    // solid-refresh only for app source: applying it to node_modules creates
    // a circular import (solid-js → solid-refresh → solid-js) and TDZ errors.
    const isAppCode = !filePath.includes("node_modules");
    const result = await babel.transformAsync(code, {
      filename: filePath,
      presets: [[solidPreset, { generate: "dom", hydratable: true, dev: true }], [tsPreset]],
      plugins: isAppCode ? [[solidRefresh.default || solidRefresh]] : [],
      configFile: false,
      babelrc: false,
      sourceMaps: "inline",
      sourceFileName: filePath,
    });
    let out = rewriteCssImports(rewriteBareImports(result.code, filePath));
    if (isAppCode) {
      // solid-refresh emits CommonJS-style `module.hot`; give each served
      // module a hot context tied to its URL.
      out = out.replace(/\bmodule\.hot\b/g, "__hmrHot__");
      out = `const __hmrHot__ = globalThis.__HMR__.createHot(${JSON.stringify(urlPath)});\n` + out;
    }
    return out;
  }

  const mimeTypes = {
    ".html": "text/html",
    ".js": "application/javascript",
    ".jsx": "application/javascript",
    ".ts": "application/javascript",
    ".tsx": "application/javascript",
    ".css": "text/css",
    ".json": "application/json",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".ico": "image/x-icon",
    ".woff2": "font/woff2",
  };

  let server;
  async function handleRequest(req) {
    if (server && server.upgrade(req)) return; // WebSocket upgrade
    const url = new URL(req.url);
    let pathname = decodeURIComponent(url.pathname);

    // Resolved-module endpoint: serve any file by absolute path (used for
    // bare imports rewritten to /@bun?f=...)
    if (pathname === "/@bun") {
      const f = url.searchParams.get("f");
      if (!f || !existsSync(f)) return new Response("Not found", { status: 404 });
      if (/\.[cm]?[jt]sx?$/.test(f)) {
        try {
          const code = await transformFile(f, "/\@bun?f=" + encodeURIComponent(f));
          return new Response(code, { headers: { "Content-Type": "application/javascript" } });
        } catch (err) {
          return new Response(String(err), { status: 500 });
        }
      }
      return new Response(Bun.file(f), {
        headers: { "Content-Type": mimeTypes[extname(f).toLowerCase()] || "application/octet-stream" },
      });
    }

    // API proxy
    if (apiProxy && pathname.startsWith("/api/")) {
      return fetch(`${apiProxy}${pathname}${url.search}`);
    }

    // SPA fallback: serve index.html for unknown routes
    let filePath;
    if (pathname === "/" || pathname === "/index.html") {
      filePath = entryHtml;
    } else {
      filePath = resolve(rootDir, pathname.slice(1));
      // Try publicDir for static assets
      if (!existsSync(filePath) && publicDir) {
        const pubPath = resolve(publicDir, pathname.slice(1));
        if (existsSync(pubPath)) filePath = pubPath;
      }
      // SPA fallback
      if (!existsSync(filePath)) {
        return new Response(injectHmr(readFileSync(entryHtml, "utf8")), {
          headers: { "Content-Type": "text/html" },
        });
      }
    }

    const ext = extname(filePath).toLowerCase();

    // Transform JS/TS on the fly
    if (/\.[cm]?[jt]sx?$/.test(filePath)) {
      try {
        const code = await transformFile(filePath, pathname);
        return new Response(code, {
          headers: { "Content-Type": "application/javascript" },
        });
      } catch (err) {
        return new Response(String(err), { status: 500 });
      }
    }

    // Serve HTML with HMR client injected
    if (ext === ".html") {
      return new Response(injectHmr(readFileSync(filePath, "utf8")), {
        headers: { "Content-Type": "text/html" },
      });
    }

    // Serve static files
    const file = Bun.file(filePath);
    return new Response(file, {
      headers: { "Content-Type": mimeTypes[ext] || "application/octet-stream" },
    });
  }

  console.log(`🚀 Dev server: http://localhost:${port}`);
  console.log(`   entry: ${entryHtml.replace(resolve(".") + "/", "")}`);
  if (apiProxy) console.log(`   proxy: /api/* → ${apiProxy}`);
  console.log(`   HMR: component-level (solid-refresh), CSS hot-swap, full reload fallback`);

  server = serve({
    fetch: handleRequest,
    port,
    websocket: {
      open(ws) { wsClients.add(ws); },
      close(ws) { wsClients.delete(ws); },
    },
  });
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
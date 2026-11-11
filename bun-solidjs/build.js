#!/usr/bin/env bun
/**
 * Generic production build script for SolidJS using bun-plugin-solid.
 *
 * Reads the JS entry point from the HTML file (like Vite):
 *   <script type="module" src="./main.jsx"></script>
 *
 * Config resolution order:
 *   1. --config=path/to/config.js   (CLI argument)
 *   2. bun.config.js                (in current working directory)
 *   3. built-in defaults            (entry: "index.html", outDir: "dist")
 *
 * Usage:
 *   bun bun-solidjs/build.js                          # auto-discover config
 *   bun bun-solidjs/build.js --config=my.config.js    # explicit config
 *   bun bun-solidjs/build.js --no-stats               # skip detailed stats
 *   bun bun-solidjs/build.js --silent                 # no output
 *
 * Can also be compiled to standalone bytecode:
 *   bun build --outfile bb --bytecode bun-solidjs/build.js
 *   ./bb --config=my.config.js
 */

import { build } from "bun";
import { resolve, dirname, basename, join } from "path";
import { mkdirSync, cpSync, existsSync, rmSync, readFileSync, writeFileSync } from "fs";
import { gzipSync } from "zlib";
import solidPluginImport from "./bun-plugin-solid.js";

const __dirname = dirname(new URL(import.meta.url).pathname);

const DEFAULT_CONFIG = {
  entry: "index.html",
  outDir: "dist",
  solid: { generate: "dom", hydratable: true, dev: false },
  build: {
    minify: true,
    splitting: true,
    target: "browser",
    conditions: ["browser", "production"],
    define: { "process.env.NODE_ENV": '"production"' },
    naming: "[name]-[hash].[ext]",
  },
};

async function main() {
  // ---- Parse args ----
  const args = process.argv.slice(2);
  const showStats = !args.includes("--no-stats");
  const silent = args.includes("--silent");
  const configArg = args.find(a => a.startsWith("--config="));

  // ---- Load config (priority: --config > ./bun.config.js > defaults) ----
  let config = DEFAULT_CONFIG;
  let configSource = "defaults";

  if (configArg) {
    configSource = configArg.split("=")[1];
    config = (await import(resolve(configArg.split("=")[1]))).default;
  } else if (existsSync(resolve("bun.config.js"))) {
    configSource = "bun.config.js";
    config = (await import(resolve("bun.config.js"))).default;
  }

  // Merge with defaults (shallow)
  config = {
    ...DEFAULT_CONFIG,
    ...config,
    solid: { ...DEFAULT_CONFIG.solid, ...config.solid },
    build: { ...DEFAULT_CONFIG.build, ...config.build },
  };

  const entryHtml = resolve(config.entry);
  const rootDir = dirname(entryHtml);
  const outDir = resolve(config.outDir);
  const publicDir = config.publicDir ? resolve(config.publicDir) : null;
  const assetsDir = resolve(outDir, "assets");

  // ---- Read entry point from HTML ----
  if (!existsSync(entryHtml)) {
    console.error(`❌ Entry HTML not found: ${entryHtml}`);
    console.error(`   Config source: ${configSource}`);
    process.exit(1);
  }

  const htmlContent = readFileSync(entryHtml, "utf8");
  const scriptMatch = htmlContent.match(/<script[^>]*type=["']module["'][^>]*src=["']([^"']+)["']/);
  if (!scriptMatch) {
    console.error(`❌ No <script type="module" src="..."> found in ${entryHtml}`);
    process.exit(1);
  }
  const entrySrc = scriptMatch[1].replace(/^[./]+/, "");
  const entryPoint = resolve(rootDir, entrySrc);

  // ---- Clean & prepare output ----
  if (existsSync(outDir)) rmSync(outDir, { recursive: true });
  mkdirSync(assetsDir, { recursive: true });

  // ---- Build ----
  // Static import - gets bundled into --compile/--bytecode binary
  const solidPlugin = solidPluginImport.default || solidPluginImport;
  let moduleCount = 0;
  const startTime = Date.now();

  const result = await build({
    entrypoints: [entryPoint],
    outdir: assetsDir,
    plugins: [
      solidPlugin({
        ...config.solid,
        onModule: () => { moduleCount++; },
      }),
    ],
    ...config.build,
  });

  if (!result.success) {
    console.error("❌ Build failed:");
    for (const log of result.logs) console.error(log);
    process.exit(1);
  }

  // ---- Process HTML output ----
  const jsOutput = result.outputs.find(o => o.path.endsWith(".js"));
  const cssOutput = result.outputs.find(o => o.path.endsWith(".css"));
  const jsName = jsOutput ? basename(jsOutput.path) : null;
  const cssName = cssOutput ? basename(cssOutput.path) : null;

  let outHtml = htmlContent;
  if (jsName) {
    outHtml = outHtml.replace(
      /<script([^>]*type=["']module["'][^>]*)src=["'][^"']+["']/,
      `<script$1crossorigin src="./assets/${jsName}"`
    );
  }
  if (cssName) {
    outHtml = outHtml.replace(
      /(<script[^>]*type=["']module["'])/,
      `<link rel="stylesheet" crossorigin href="./assets/${cssName}">\n    $1`
    );
  }
  writeFileSync(resolve(outDir, basename(entryHtml)), outHtml);

  // ---- Copy public dir ----
  if (publicDir && existsSync(publicDir)) {
    cpSync(publicDir, outDir, { recursive: true });
  }

  // ---- Stats ----
  const buildTime = Date.now() - startTime;

  if (showStats && !silent) {
    console.log(`\nbun v${process.versions.bun} building for production...`);
    console.log(`config: ${configSource}`);
    console.log(`entry:  ${entryHtml.replace(resolve(".") + "/", "")}`);
    console.log(`bundling...`);
    console.log(`✓ ${moduleCount} modules bundled.`);
    console.log(`minifying...`);
    console.log(`computing gzip size...\n`);

    const allFiles = [
      { path: resolve(outDir, basename(entryHtml)) },
      ...result.outputs,
    ].filter(f => existsSync(f.path));

    allFiles.sort((a, b) => {
      const order = { html: 0, js: 1, css: 2 };
      const ext = p => p.path.split(".").pop().toLowerCase();
      return (order[ext(a)] ?? 3) - (order[ext(b)] ?? 3);
    });

    const projectRoot = resolve(".");
    const relPaths = allFiles.map(f => f.path.replace(projectRoot + "/", ""));
    const maxWidth = Math.max(...relPaths.map(p => p.length)) + 3;

    for (let i = 0; i < allFiles.length; i++) {
      const content = readFileSync(allFiles[i].path);
      const gz = gzipSync(content);
      const size = (content.length / 1024).toFixed(2).padStart(8);
      const gzip = (gz.length / 1024).toFixed(2).padStart(6);
      console.log(`${relPaths[i].padEnd(maxWidth)}${size} kB │ gzip: ${gzip} kB`);
    }

    console.log(`\n✓ built in ${buildTime}ms`);
  } else if (!silent) {
    console.log(`✅ Build succeeded in ${buildTime}ms → ${outDir}`);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
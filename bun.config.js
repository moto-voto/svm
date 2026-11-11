// @ts-check
/** @type {import('./bun-solidjs/bun.config.d.ts').BunSolidConfig} */
import { resolve } from "path";

export default {
  entry: resolve("src/ui/index.html"),
  outDir: resolve("dist/public"),
  publicDir: resolve("src/ui/public"),
  solid: {
    generate: "dom",
    hydratable: true,
    dev: false,
  },
  server: {
    port: 5173,
    apiProxy: "http://localhost:3000",
  },
  build: {
    minify: true,
    splitting: true,
    target: "browser",
    conditions: ["browser", "production"],
    define: {
      "process.env.NODE_ENV": '"production"',
    },
    naming: "[name]-[hash].[ext]",
  },
};
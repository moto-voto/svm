// @ts-check
/** @type {import('./bun.config.d.ts').BunSolidConfig} */
import { resolve } from "path";

export default {
  // Path to your HTML entry file
  // The JS entry point is read from: <script type="module" src="./index.jsx"></script>
  entry: resolve("src/ui/index.html"),

  // Output directory (cleaned before build)
  outDir: resolve("dist/public"),

  // Static assets dir (favicons, etc.) copied to outDir root - optional
  publicDir: resolve("src/ui/public"),

  // Solid plugin options
  solid: {
    generate: "dom",       // "dom" | "ssr"
    hydratable: true,      // enable hydration markers
    dev: false,            // dev mode: source maps + HMR
  },

  // Bun.build() options
  build: {
    minify: true,
    splitting: true,
    target: "browser",     // "browser" | "bun" | "node"
    conditions: ["browser", "production"],
    define: {
      "process.env.NODE_ENV": '"production"',
    },
    naming: "[name]-[hash].[ext]",
  },
};
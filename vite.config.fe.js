import { defineConfig } from "vite";
import solid from "vite-plugin-solid";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ command }) => {
  /**
   * The deployment prefix is NOT known at build time (nginx decides it), so
   * production builds use Vite's relative base (`./`): index.html references
   * `./assets/...`, which the browser resolves against whatever URL the SPA
   * was served from. The app then detects the real prefix at runtime from the
   * entry script's URL (see `src/ui/utils.js`).
   *
   * The Vite dev server needs an absolute base, so allow `BASE_PATH=/svm` there.
   */
  const devBase = process.env.BASE_PATH || "/";
  const base = command === "build" ? "./" : devBase;
  const apiPrefix = `${devBase.replace(/\/$/, "")}/api` || "/api";

  return {
    root: "src/ui",             // Treats src/ui as the web root
    base,
    plugins: [solid()],
    server: {
      port: 5173,
      proxy: {
        [apiPrefix]: {
          target: "http://localhost:3000",
          changeOrigin: true,
          secure: false,
          bypass: (req) => {
            if (req.url.endsWith(".js") || req.url.includes("/src/")) {
              return req.url;
            }
          },
        },
      },
    },
    build: {
      // Outputs to dist/public at the repo root (navigating up one level from root: src/ui)
      outDir: resolve(__dirname, "dist/public"),
      emptyOutDir: true,
    },
  };
});
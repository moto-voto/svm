import { defineConfig } from "vite";
import solid from "vite-plugin-solid";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: "src/ui",             // Treats src/ui as the web root
  base: "/",
  plugins: [solid()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
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
});
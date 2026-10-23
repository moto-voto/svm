import { defineConfig } from "vite";
import solid from "vite-plugin-solid";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: __dirname,
  // Served by Express at the site root.
  base: "/",
  plugins: [solid()],
  server: {
    port: 5173, // Vite dev server port
    proxy: {
      // Forward any request starting with /api to your Express backend
      "/api": {
        target: "http://localhost:3000", // Replace with your Express server port
        changeOrigin: true,
        secure: false,
        // Add this bypass function:
        bypass: (req, res, options) => {
          // If the request is for a frontend script file, bypass the proxy
          // and let Vite's dev server handle it normally.
          if (req.url.endsWith(".js") || req.url.includes("/src/")) {
            return req.url; // Returns the url to Vite instead of forwarding to Express
          }
        },
      },
    },
  },
  build: {
    outDir: join(__dirname, "dist"),
    emptyOutDir: true,
  },
});

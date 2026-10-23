import { defineConfig } from 'vite';
import solid from 'vite-plugin-solid';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Backend dev server that serves the `/api/*` routes (see src/server.js).
const BACKEND_ORIGIN = process.env.BACKEND_ORIGIN || `http://localhost:${process.env.PORT || 3000}`;

export default defineConfig({
    root: __dirname,
    // Served by Express at the site root.
    base: '/',
    plugins: [solid()],
    server: {
        // In dev the UI runs on Vite's own port; forward API calls to Express.
        proxy: {
            '/api': {
                target: BACKEND_ORIGIN,
                changeOrigin: true,
            },
        },
    },
    build: {
        outDir: join(__dirname, 'dist'),
        emptyOutDir: true,
    },
});

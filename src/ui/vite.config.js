import { defineConfig } from 'vite';
import solid from 'vite-plugin-solid';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
    root: __dirname,
    // Served by Express under /solid so built asset URLs resolve correctly.
    base: '/solid/',
    plugins: [solid()],
    build: {
        outDir: join(__dirname, 'dist'),
        emptyOutDir: true,
    },
});

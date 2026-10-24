import { defineConfig } from 'vite';

/**
 * Backend build: bundles the API + SPA server and every server-side dependency
 * into a single `dist/svm.js`. The frontend is NOT embedded — the server reads
 * it from disk at runtime (`dist/public`, see src/server.js), so keep the
 * frontend build (`npm run build:fe`) in place next to the bundle.
 */
export default defineConfig({
  build: {
    ssr: 'src/server.js',
    outDir: 'dist',
    // Don't wipe a separate `dist/public` frontend build.
    emptyOutDir: false,
    target: 'node24',
    minify: true,
    sourcemap: false,
    reportCompressedSize: false,
    rollupOptions: {
      output: {
        format: 'es',
        entryFileNames: 'svm.js',
        codeSplitting: false,
      },
    },
  },
  // Inline all dependencies (express, cheerio, ...) so `node dist/svm.js`
  // needs no node_modules. Node built-ins stay external automatically.
  ssr: { noExternal: true },
});
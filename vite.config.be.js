import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    ssr: 'src/server.js',
    outDir: 'dist',
    target: 'node24',             // Updated to Node 24
    minify: true,
    sourcemap: false,
    reportCompressedSize: false, 
    rollupOptions: {
      output: {
        format: 'es',
        entryFileNames: 'svm.js',
        codeSplitting: false,
      },
      external: [],
    },
  },
});

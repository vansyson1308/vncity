import { defineConfig } from 'vite';
// base './' để chạy được ở GitHub Pages (vansyson1308.github.io/vncity/) lẫn máy cá nhân.
export default defineConfig({ base: './', build: { outDir: 'dist', chunkSizeWarningLimit: 1500, assetsInlineLimit: 0 } });

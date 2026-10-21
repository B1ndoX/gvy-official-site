import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
  base: '/games/ship-battle/',
  plugins: [react()],
  build: { target: 'es2022', outDir: 'dist', rollupOptions: { output: { manualChunks(id) { if(id.includes('/pixi.js/')) return 'pixi'; } } } },
});

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import {readFile} from 'node:fs/promises';
export default defineConfig({
  base: '/games/ship-battle/',
  plugins: [react(),{
    name:'local-official-site-logo',
    configureServer(server){
      // Production gets this shared URL from the official site. Local Vite
      // serves the same file for the developer-only calibration workspace.
      server.middlewares.use(async(request,response,next)=>{
        if(request.url?.split('?')[0]!=='/assets/gvy-logo-hq.png')return next();
        try{const image=await readFile(new URL('../../assets/gvy-logo-hq.png',import.meta.url));response.setHeader('Content-Type','image/png');response.end(image);}catch(error){next(error);}
      });
    },
  }],
  build: { target: 'es2022', outDir: 'dist', rollupOptions: { output: { manualChunks(id) { if(id.includes('/pixi.js/')) return 'pixi'; } } } },
});

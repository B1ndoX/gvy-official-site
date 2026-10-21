import {build} from 'vite';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const out=await mkdtemp(join(tmpdir(),'gvy-calibration-'));
try{await build({configFile:false,logLevel:'error',build:{ssr:fileURLToPath(new URL('./balance-sample.ts',import.meta.url)),outDir:out,emptyOutDir:false,rollupOptions:{output:{entryFileNames:'sample.mjs'}}}});await import(pathToFileURL(join(out,'sample.mjs')).href);}finally{await rm(out,{recursive:true,force:true});}

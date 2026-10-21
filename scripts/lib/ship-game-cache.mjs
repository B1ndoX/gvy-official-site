import {readFile} from 'node:fs/promises';
export async function shipGameCacheWorker(files){
  const resources=Object.entries(files).sort(([a],[b])=>a.localeCompare(b)).map(([path,sha])=>({url:`/games/ship-battle/${path}`,revision:sha}));
  return `const RESOURCES=${JSON.stringify(resources)};\n`+await readFile(new URL('./ship-game-cache-worker.js',import.meta.url),'utf8');
}

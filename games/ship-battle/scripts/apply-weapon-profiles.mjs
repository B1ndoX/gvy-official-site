import { readFile,writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
const root=new URL('../',import.meta.url);
const profiles=JSON.parse(await readFile(new URL('src/data/weapon-profiles.json',root),'utf8'));
/** Idempotent: regeneration cannot silently restore the old generic weapons. */
export function applyWeaponProfiles(ships){
  for(const p of profiles.ships){
    const s=ships.find(s=>s.id===p.id);if(!s)throw new Error(`Unknown weapon profile ${p.id}`);
    const replaced=new Set([...p.remove,...p.mounts.map(m=>m.id)]);
    const support=s.mounts.filter(m=>!replaced.has(m.id));
    if(p.supportDps!==undefined){const total=support.reduce((n,m)=>n+m.damage/m.cooldown,0);for(const m of support)m.damage=Number((m.damage*p.supportDps/total).toFixed(2));}
    s.mounts=[...structuredClone(p.mounts),...support];
  }
  return ships;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const file=new URL('src/data/ships.json',root),ships=applyWeaponProfiles(JSON.parse(await readFile(file,'utf8')));
  await writeFile(file,JSON.stringify(ships,null,2)+'\n');
  const manifestFile=new URL('public/assets/ships/manifest.json',root),manifest=JSON.parse(await readFile(manifestFile,'utf8'));
  for(const a of manifest.assets){const s=ships.find(s=>s.id===a.shipId);a.mounts=s.mounts;if(profiles.ships.some(p=>p.id===s.id))a.combatVersion=profiles.version;}
  await writeFile(manifestFile,JSON.stringify(manifest,null,2)+'\n');
  console.log(`Applied ${profiles.ships.length} signature weapon profiles; ship images unchanged.`);
}

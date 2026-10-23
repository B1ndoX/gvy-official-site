import { readFile,writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
const root=new URL('../',import.meta.url);
const layouts=JSON.parse(await readFile(new URL('src/data/turret-layouts.json',root),'utf8'));
export function applyTurretLayouts(ships){
  for(const ship of ships){
    const layout=layouts.ships[ship.id];if(!layout)continue;
    const before=ship.mounts.filter(m=>m.kind==='turret'),budget=before.reduce((sum,m)=>sum+m.damage/m.cooldown,0);
    if(layout.turretCount){
      const template=before[0];if(!template)throw new Error(`Missing turret template ${ship.id}`);
      for(let i=1;i<=layout.turretCount;i++)if(!ship.mounts.some(m=>m.id===`turret-${i}`))ship.mounts.push({...template,id:`turret-${i}`});
    }
    for(const mount of ship.mounts){const point=layout.mounts[mount.id];if(point&&mount.kind==='turret')Object.assign(mount,point);}
    if(layout.preserveTurretDps){
      const turrets=ship.mounts.filter(m=>m.kind==='turret'),total=turrets.reduce((sum,m)=>sum+m.damage/m.cooldown,0);
      if(total>0)for(const mount of turrets)mount.damage=Number((mount.damage*budget/total).toFixed(6));
    }
  }return ships;
}
export function turretLayoutVersion(id){return layouts.ships[id]?(layouts.ships[id].version??layouts.version):0;}
const profiles=JSON.parse(await readFile(new URL('src/data/weapon-profiles.json',root),'utf8'));
export function weaponProfileVersion(id,fallback){const p=profiles.ships.find(p=>p.id===id);return Math.max(p?(p.combatVersion??profiles.version):fallback,profiles.capitalCoverage?.ships[id]?profiles.capitalCoverage.version:0);}
export function applyCapitalCoverage(ships){
  for(const ship of ships){
    const count=profiles.capitalCoverage?.ships[ship.id];if(!count||ship.length<profiles.capitalCoverage.minLength)continue;
    ship.mounts=ship.mounts.filter(m=>!m.id.startsWith('coverage-turret-'));
    const template=ship.mounts.find(m=>m.kind==='turret'&&m.role==='point-defense');if(!template)throw new Error(`Missing defense turret ${ship.id}`);
    for(let i=0;i<count;i++){const side=i%2?1:-1,y=-.34+Math.floor(i/2)*.68/Math.max(1,count/2-1);ship.mounts.push({...template,id:`coverage-turret-${i+1}`,x:side*.32,y:Number(y.toFixed(3)),facing:side*90,arc:220,damage:Number((template.damage*.5).toFixed(2))});}
  }return applyTurretLayouts(ships);
}
/** Idempotent: regeneration cannot silently restore the old generic weapons. */
export function applyWeaponProfiles(ships){
  for(const p of profiles.ships){
    const s=ships.find(s=>s.id===p.id);if(!s)throw new Error(`Unknown weapon profile ${p.id}`);
    s.mounts=s.mounts.filter(m=>!m.id.startsWith('coverage-turret-'));
    const replaced=new Set([...p.remove,...p.mounts.map(m=>m.id)]);
    const support=s.mounts.filter(m=>!replaced.has(m.id));
    if(p.supportDps!==undefined){const total=support.reduce((n,m)=>n+m.damage/m.cooldown,0);for(const m of support)m.damage=Number((m.damage*p.supportDps/total).toFixed(2));}
    s.mounts=[...structuredClone(p.mounts),...support];
  }
  return applyCapitalCoverage(ships);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const file=new URL('src/data/ships.json',root),ships=applyWeaponProfiles(JSON.parse(await readFile(file,'utf8')));
  await writeFile(file,JSON.stringify(ships,null,2)+'\n');
  const manifestFile=new URL('public/assets/ships/manifest.json',root),manifest=JSON.parse(await readFile(manifestFile,'utf8'));
  for(const a of manifest.assets){const s=ships.find(s=>s.id===a.shipId);a.mounts=s.mounts;a.combatVersion=weaponProfileVersion(s.id,a.combatVersion);a.turretLayoutVersion=turretLayoutVersion(s.id);}
  await writeFile(manifestFile,JSON.stringify(manifest,null,2)+'\n');
  console.log(`Applied ${profiles.ships.length} signature weapon profiles; ship images unchanged.`);
}

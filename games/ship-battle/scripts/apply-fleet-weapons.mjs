import {readFile,writeFile} from 'node:fs/promises';
import {applyWeaponProfiles,weaponProfileVersion,turretLayoutVersion} from './apply-weapon-profiles.mjs';
import {usesFleetWeapons,loadouts,applyWeaponResources} from './fleet-weapon-mapping.mjs';
import {applyConceptWeapons} from './concept-weapon-estimates.mjs';
import {weaponValueTable} from './weapon-value-table.mjs';
const root=new URL('../',import.meta.url),path=new URL('src/data/ships.json',root),ships=JSON.parse(await readFile(path,'utf8'));
const selected=new Set(ships.filter(s=>usesFleetWeapons(s.id)).map(s=>s.id));
await writeFile(new URL('src/data/weapon-game-values.json',root),JSON.stringify(weaponValueTable(),null,2)+'\n');
applyWeaponProfiles(ships,selected);
applyConceptWeapons(ships);applyWeaponResources(ships);
const assetsPath=new URL('public/assets/ships/manifest.json',root),manifest=JSON.parse(await readFile(assetsPath,'utf8'));
for(const a of manifest.assets){if(!selected.has(a.shipId))continue;const s=ships.find(s=>s.id===a.shipId);a.mounts=s.mounts;a.combatVersion=weaponProfileVersion(s.id,a.combatVersion);a.turretLayoutVersion=turretLayoutVersion(s.id);}
await writeFile(path,JSON.stringify(ships,null,2)+'\n');await writeFile(assetsPath,JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({updated:selected.size,unarmed:ships.filter(s=>loadouts[s.id].status==='unarmed').length,fallbackUnchanged:ships.filter(s=>!selected.has(s.id)).length}));

/** Deterministic fleet generation. Boss encounter adjustments live in boss-mode-balance. */
import {readFile,writeFile} from 'node:fs/promises';
import {applyWeaponProfiles,weaponProfileVersion,turretLayoutVersion} from './apply-weapon-profiles.mjs';
import {shipFacts,shipRules,convertShipFacts,combatRole} from './ship-stat-model.mjs';
import {applyEstimatedWeapons} from './estimated-weapon-mapping.mjs';
import {mission} from './concept-estimates.mjs';
import {applyConceptWeapons} from './concept-weapon-estimates.mjs';
import {applyWeaponResources} from './fleet-weapon-mapping.mjs';
import {weaponValueTable} from './weapon-value-table.mjs';
const root=new URL('../',import.meta.url),file=new URL('src/data/ships.json',root),ships=JSON.parse(await readFile(file,'utf8'));
const artwork=JSON.parse(await readFile(new URL('docs/starjump-sources.json',root),'utf8')).assets;
const engineLayouts=JSON.parse(await readFile(new URL('src/data/engine-layouts.json',root),'utf8'));
const defense=JSON.parse(await readFile(new URL('src/data/defense-balance.json',root),'utf8'));
const audit={version:shipRules.version,combatVersion:shipRules.combatVersion,sourceVersion:shipFacts.snapshotVersion,ships:{}};
await writeFile(new URL('src/data/weapon-game-values.json',root),JSON.stringify(weaponValueTable(),null,2)+'\n');
for(const ship of ships){
 const reference=shipFacts.ships[ship.id];if(!reference)throw Error(`Missing source record ${ship.id}`);
 const converted=convertShipFacts({...reference,id:ship.id,role:ship.role,manufacturer:ship.manufacturer}),{estimated,estimation,...stats}=converted;
 Object.assign(ship,stats);
 const image=artwork.find(a=>a.shipId===ship.id);if(!image)throw Error(`Missing artwork geometry ${ship.id}`);
 // Keep original PNG proportions; measured physical beam/height remain separate facts.
 ship.beam=Number((ship.length*image.height/image.width).toFixed(6));
 ship.physicalBeam=reference.facts.beam??null;ship.height=reference.facts.height??null;
 ship.dimensionsStatus=reference.geometryConflict?'source-conflict estimated length / original artwork projection':reference.facts.length?'source-length / original artwork projection; physical beam stored separately':'estimated length / original artwork projection';
 const engineLayout=engineLayouts.ships[ship.id];ship.engines=engineLayouts.ships[engineLayout.aliasOf??ship.id].nozzles;
 ship.statVersion=shipRules.combatVersion;
 ship.class=ship.length>=100?'capital':ship.length>=35?'heavy':'fighter';
 ship.defenseTier=(defense.tiers.find(t=>ship.length<t.maxLength)??defense.tiers.at(-1)).id;
 ship.defenseRole=mission(ship).functional?'civilian':combatRole(ship.role);
 if(ship.id==='zeus'){ship.battleReady=false;ship.assetIssue='Unverified historical/concept artwork; source catalogFake=true. Use Zeus Mk II variants for combat.';}
 ship.preferredRange=ship.doctrine==='bomber'?Math.min(1100,850+ship.length*.3):ship.doctrine==='escort'?590:ship.class==='capital'?850:ship.class==='heavy'?500:380;
 audit.ships[ship.id]={sourceName:reference.sourceName,measured:Object.keys(reference.facts),estimated,estimation,shieldCapacityEstimated:reference.provenance.shieldCapacity!=='component-model',values:{...stats,projectionBeam:ship.beam,physicalBeam:ship.physicalBeam,height:ship.height}};
}
applyWeaponProfiles(ships);applyEstimatedWeapons(ships);const conceptWeapons=applyConceptWeapons(ships);applyWeaponResources(ships);
await writeFile(new URL('src/data/concept-weapon-estimates.json',root),JSON.stringify(conceptWeapons,null,2)+'\n');
await writeFile(file,JSON.stringify(ships,null,2)+'\n');
const assetFile=new URL('public/assets/ships/manifest.json',root),manifest=JSON.parse(await readFile(assetFile,'utf8'));
for(const a of manifest.assets){const ship=ships.find(s=>s.id===a.shipId);a.length=ship.length;a.beam=ship.beam;a.mounts=ship.mounts;a.engines=ship.engines;a.engineLayoutVersion=engineLayouts.version;a.combatVersion=weaponProfileVersion(ship.id,a.combatVersion);a.turretLayoutVersion=turretLayoutVersion(ship.id);}
await writeFile(assetFile,JSON.stringify(manifest,null,2)+'\n');
await writeFile(new URL('src/data/ship-game-values.json',root),JSON.stringify(audit,null,2)+'\n');
console.log(`Generated ${ships.length} ships with one conversion including boss hulls; PNGs and normalized anchors unchanged.`);

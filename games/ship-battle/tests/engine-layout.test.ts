import {expect,test} from 'vitest';
import ships from '../src/data/ships.json';
import layouts from '../src/data/engine-layouts.json';
import manifest from '../public/assets/ships/manifest.json';
import {upgradeCombat,type ShipAsset} from '../src/assets/library';
test('every model consumes its reviewed engine layout, and uncertain projections have no generic double flame',()=>{
 expect(Object.keys(layouts.ships)).toHaveLength(224);
 for(const s of ships){const records=layouts.ships as Record<string,{nozzles?:{x:number;y:number}[];status:string;aliasOf?:string}>,row=records[s.id],layout=records[row.aliasOf??s.id];expect(layout.nozzles).toBeDefined();expect(s.engines).toEqual(layout.nozzles);expect(layout.nozzles!.every(p=>Number.isFinite(p.x+p.y)&&Math.abs(p.x)<=.5&&Math.abs(p.y)<=.5)).toBe(true);if(layout.status==='not-visible-confirmed')expect(s.engines).toHaveLength(0);}
 expect(ships.find(s=>s.id==='arrow')!.engines).toHaveLength(1);expect(ships.find(s=>s.id==='hornet-mk2')!.engines).toHaveLength(1);expect(ships.find(s=>s.id==='constellation-taurus')!.engines).toHaveLength(4);
 expect(ships.find(s=>s.id==='javelin')!.engines).toHaveLength(8);expect(ships.find(s=>s.id==='polaris')!.engines).toHaveLength(4);
 expect(ships.find(s=>s.id==='reliant-kore')!.engines).toHaveLength(2);expect(ships.find(s=>s.id==='bengal')!.engines).toHaveLength(4);
 expect(ships.find(s=>s.id==='idris-m')!.engines).toHaveLength(4);expect(ships.find(s=>s.id==='apollo-medivac')!.engines).toHaveLength(2);
 for(const [canonical,variants] of Object.entries(layouts.sharedExteriorGroups))for(const id of variants){expect(ships.find(s=>s.id===id)!.engines).toEqual(ships.find(s=>s.id===canonical)!.engines);}
});
test('stock cached exhausts upgrade independently; custom/calibrated coordinates are retained',()=>{
 const builtin=manifest.assets.find(s=>s.shipId==='arrow') as ShipAsset,old={...structuredClone(builtin),engineLayoutVersion:0,engines:[{x:.1,y:.2}]};
 expect(upgradeCombat(old,builtin).engines).toEqual(builtin.engines);expect(upgradeCombat({...old,calibrated:true},builtin).engines).toEqual(old.engines);expect(upgradeCombat({...old,url:'assets/ships/custom.png'},builtin).engines).toEqual(old.engines);
});

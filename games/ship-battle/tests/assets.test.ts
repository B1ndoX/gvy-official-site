import { describe,expect,test } from 'vitest';
import fs from 'node:fs';
import crypto from 'node:crypto';
import manifest from '../public/assets/ships/manifest.json';
import sources from '../docs/starjump-sources.json';
import data from '../src/data/ships.json';
import fleet from '../src/data/fleet-weapon-loadouts.json';
import {weaponDps} from '../src/sim/weapons';
import gameValues from '../src/data/weapon-game-values.json';
import {validateAsset,withAssets,upgradeCombat,type ShipAsset} from '../src/assets/library';
import type {ShipSpec} from '../src/sim/types';
const ids=new Set(data.map(s=>s.id));
describe('REA-captured original ship assets',()=>{
 test('224 PNG files match captured SHA-256, dimensions, names and manifest',()=>{expect(manifest.assets).toHaveLength(224);expect(new Set(manifest.assets.map(a=>a.shipId)).size).toBe(224);for(const a of manifest.assets){expect(()=>validateAsset(a,ids)).not.toThrow();const entry=sources.assets.find(s=>s.shipId===a.shipId)!;const file=fs.readFileSync(new URL('../public/'+a.url,import.meta.url));expect(crypto.createHash('sha256').update(file).digest('hex')).toBe(entry.sha256);expect(file.readUInt32BE(16)).toBe(entry.width);expect(file.readUInt32BE(20)).toBe(entry.height);expect(a.noseDegrees).toBe(-90);expect(a.beam/a.length).toBeCloseTo(entry.height/entry.width,3);}});
 test('every ship has source, engines, weapon data and explicit calibration status',()=>{for(const s of withAssets(data as ShipSpec[],manifest.assets as ShipAsset[])){expect(Array.isArray(s.engines)).toBe(true);expect(s.engines.length).toBeLessThanOrEqual(32);expect(s.mounts.length).toBeGreaterThanOrEqual((fleet.ships as Record<string,{status:string}>)[s.id].status==='unarmed'?0:1);expect(s.calibration).toBe('draft');if((fleet.ships as Record<string,{status:string}>)[s.id].status==='unarmed')expect(s.mounts).toHaveLength(0);}});
 test('malformed import data cannot introduce remote scripts, NaNs or invalid mounts',()=>{const base=manifest.assets[0];for(const patch of [{url:'javascript:alert(1)'},{length:Number.NaN},{noseDegrees:Infinity},{mounts:[]},{author:''},{center:{x:5,y:0}},{url:'assets/ships/../../bad.png'}])expect(()=>validateAsset({...base,...patch},ids)).toThrow();});
 test('combat upgrades preserve imported artwork and mount calibration while updating old weapon balance',()=>{const base=manifest.assets[0] as ShipAsset,local={...base,combatVersion:0,url:'data:image/png;base64,original',length:30,mounts:base.mounts.map(m=>({...m,x:.2,damage:9999,cooldown:.1}))};const upgraded=upgradeCombat(local,base);expect(upgraded.url).toBe(local.url);expect(upgraded.length).toBe(30);expect(upgraded.mounts[0].x).toBe(.2);expect(upgraded.mounts[0].damage).toBe(base.mounts[0].damage);expect(upgradeCombat(upgraded,base)).toBe(upgraded);});
});

test('old boss calibration gains new independent turrets without duplicating them or losing coordinates',()=>{
 const base=manifest.assets.find(a=>a.shipId==='mauler') as ShipAsset,local={...base,combatVersion:3,mounts:base.mounts.filter(m=>!m.id.startsWith('boss-turret-')).map(m=>({...m,x:.123}))};
 const next=upgradeCombat(local,base);expect(next.mounts).toHaveLength(base.mounts.length);expect(next.mounts[0].x).toBe(.123);expect(next.mounts[0].speed).toBe(base.mounts[0].speed);expect(new Set(next.mounts.map(m=>m.id)).size).toBe(next.mounts.length);expect(upgradeCombat(next,base)).toBe(next);
});


test('new stock turret geometry replaces stale default coordinates even with current combat data; custom calibration survives',()=>{
 const base=manifest.assets.find(a=>a.shipId==='bengal') as ShipAsset,old={...base,turretLayoutVersion:0,mounts:base.mounts.map(m=>({...m,x:.49,y:.49}))};
 const next=upgradeCombat(old,base);expect(next.turretLayoutVersion).toBe(base.turretLayoutVersion);expect(next.mounts.filter(m=>m.kind==='turret')).toEqual(base.mounts.filter(m=>m.kind==='turret'));expect(next.mounts.filter(m=>m.weaponId)).toEqual(base.mounts.filter(m=>m.weaponId));
 const custom=upgradeCombat({...old,calibrated:true},base);expect(custom.mounts.every(m=>m.x===.49)).toBe(true);
 const imported=upgradeCombat({...old,url:'data:image/png;base64,custom'},base);expect(imported.mounts.every(m=>m.x===.49)).toBe(true);expect(upgradeCombat(next,base)).toBe(next);
});

test.each(['hammerhead','hammerhead-2949-best-in-show'])('%s uses six user-marked turrets with four real S4 guns each',id=>{
 const base=manifest.assets.find(a=>a.shipId===id) as ShipAsset,spec=data.find(s=>s.id===id)! as ShipSpec;
 const turrets=spec.mounts.filter(m=>m.kind==='turret');expect(turrets).toHaveLength(6);expect(base.mounts).toEqual(spec.mounts);
 expect(turrets.every(m=>m.weaponCount===4&&m.weaponSize===4)).toBe(true);expect(turrets.reduce((sum,m)=>sum+weaponDps(m),0)).toBeCloseTo(24*gameValues.weapons['s4-cf-447-rhino-repeater'].combat.damage/gameValues.weapons['s4-cf-447-rhino-repeater'].combat.cooldown,3);
 // Four outer rings plus the centre and nose rings, in the shipped image's canonical frame.
 expect(turrets.filter(m=>Math.abs(m.x)>.3)).toHaveLength(4);expect(turrets.filter(m=>Math.abs(m.x)<.03)).toHaveLength(2);
 expect(turrets.some(m=>m.y>.3)).toBe(true);expect(new Set(turrets.map(m=>`${m.x}:${m.y}`)).size).toBe(6);
 const old={...base,turretLayoutVersion:1,mounts:base.mounts.filter(m=>!['turret-5','turret-6'].includes(m.id)).map(m=>m.kind==='turret'?{...m,x:.1,y:.1,facing:0}:m)};
 expect(upgradeCombat(old,base).mounts).toEqual(base.mounts);expect(upgradeCombat(old,base).turretLayoutVersion).toBe(4);
});
test('all Terrapin variants share the marked two pilot muzzles and upgrade the old merged pair without adding firepower',()=>{
 const variants=manifest.assets.filter(a=>a.shipId.startsWith('terrapin')) as ShipAsset[];
 expect(variants.length).toBeGreaterThanOrEqual(2);
 for(const base of variants){
  expect(base.mounts).toHaveLength(2);expect(base.mounts.map(m=>({x:m.x,y:m.y}))).toEqual([{x:-.21,y:-.37},{x:.21,y:-.37}]);
  expect(base.mounts.every(m=>m.fireControl==='pilot'&&m.weaponSize===2&&(m.barrels??1)===1)).toBe(true);
  expect(base.mounts.reduce((n,m)=>n+(m.capacitor??0),0)).toBe(150);
  const first=base.mounts[0],legacy={...base,combatVersion:17,turretLayoutVersion:4,mounts:[{...first,x:-.22,y:-.26,weaponCount:2,barrels:2,capacitor:150}]};
  expect(upgradeCombat(legacy,base).mounts).toEqual(base.mounts);
  const gun=gameValues.weapons['s2-cf-227-badger-repeater'].combat;
  expect(base.mounts.reduce((n,m)=>n+weaponDps(m),0)).toBeCloseTo(2*gun.damage/gun.cooldown,3);
 }
});
test('Polaris assigned platforms match the user-marked S3/S4/S6 locations and migrate cached coordinates',()=>{
 const base=manifest.assets.find(a=>a.shipId==='polaris') as ShipAsset,guns=base.mounts.filter(m=>m.kind==='turret'&&!m.interceptsOnly);
 const small=guns.filter(m=>m.weaponSize===3),medium=guns.filter(m=>m.weaponSize===4),bow=guns.find(m=>m.weaponSize===6)!;
 expect(small).toHaveLength(3);expect(small.every(m=>m.barrels===4)).toBe(true);
 expect(small.some(m=>m.x===0&&m.y>.4)).toBe(true);expect(small.filter(m=>Math.abs(m.x)>.25&&m.y<0)).toHaveLength(2);
 expect(medium).toHaveLength(2);expect(medium.every(m=>m.barrels===4&&m.y<-.16&&Math.abs(m.x)<.12)).toBe(true);
 expect(bow.x).toBe(0);expect(bow.y).toBe(-.35);expect(bow.barrels).toBe(2);
 const stale={...base,turretLayoutVersion:4,mounts:base.mounts.map(m=>({...m,x:.42,y:.42}))};
 expect(upgradeCombat(stale,base).mounts).toEqual(base.mounts);
});

import {expect,test} from 'vitest';
import data from '../src/data/ships.json';
import facts from '../src/data/ship-reference-facts.json';
import loads from '../src/data/fleet-weapon-loadouts.json';
import manifest from '../public/assets/ships/manifest.json';
import layouts from '../src/data/turret-layouts.json';
import fleet from '../src/data/fleet-gameplay-balance.json';
import tuning from '../src/data/fleet-combat-tuning.json';
import {localizedShips} from '../src/data/localized-ships';
import {prepareCombatSpecs,hullRetention} from '../src/sim/combat-tuning';
import {BattleEngine} from '../src/sim/engine';
import {isMemberShip,assignMemberShips} from '../src/sim/members';
import {analogue} from '../scripts/concept-estimates.mjs';
import {upgradeCombat,type ShipAsset} from '../src/assets/library';
import type {ShipSpec} from '../src/sim/types';
const ships=data as ShipSpec[],ids=['skylark','marauder','hyun'] as const;
test.each([
 ['skylark',6230,6000,227,3,2,10,1],
 ['marauder',7100,6000,223,7,3,4,1],
 ['hyun',71764,14400,160,4,3,8,2],
] as const)('%s retains exact current fleet-bot hull, shield, SCM, gun count and missile stock before shared gameplay conversion',(id,hull,shield,scm,guns,size,ammo,missileSize)=>{
 const source=facts.ships[id],s=ships.find(s=>s.id===id)!;
 expect(source.snapshotVersion).toBe('4.10.3-LIVE.13220821');expect(loads.ships[id].snapshotVersion).toBe(source.snapshotVersion);
 expect(source.facts.hullTotal).toBe(hull);expect(s.hull).toBe(hull);expect(source.facts.shieldCapacity).toBe(shield);expect(s.shield).toBe(shield);
 expect(source.facts.scm).toBe(scm);expect(s.speed/.75).toBe(scm);
 expect(s.mounts.filter(m=>m.kind==='laser').reduce((n,m)=>n+(m.barrels??1),0)).toBe(guns);
 expect(s.mounts.filter(m=>m.kind==='laser').every(m=>m.weaponSize===size&&m.fireControl==='pilot')).toBe(true);
 const missile=s.mounts.find(m=>m.kind==='missile')!;expect(missile.ammo).toBe(ammo);expect(missile.weaponSize).toBe(missileSize);
 expect(source.inputs['assets/ship-loadouts-erkul.json']).toBe('95714ef0f31ace11e3d6b65f331ecb763a0919d605b6cdd302884e705af5e43c');
});
test('all new models are translated, drawable and eligible for the existing uniform member pool without a duplicate Marauder',()=>{
 for(const id of ids){expect(ships.filter(s=>s.id===id)).toHaveLength(1);expect(isMemberShip(ships.find(s=>s.id===id)!)).toBe(true);expect(localizedShips.find(s=>s.id===id)!.name).toMatch(/[\u4e00-\u9fff]/);}
 expect(ships.some(s=>s.id==='maruader')).toBe(false);
 const members=ids.map((id,i)=>({handle:'test'+i,name:id,avatar:''}));
 const assigned=assignMemberShips(members,ships.filter(s=>ids.includes(s.id as typeof ids[number])),42);
 expect(assigned).toHaveLength(3);expect(assigned.every(s=>ids.includes(s.specId as typeof ids[number]))).toBe(true);
});
test.each(['brawl','teams','bounty','challenge'] as const)('new members use the same shared damage, hull/shield and spawn rules as existing members in %s',mode=>{
 const before=JSON.stringify(ships),prepared=prepareCombatSpecs(ships);
 const e=new BattleEngine();e.reset(ids.map(specId=>({specId,count:1})),prepared,42,mode);
 for(const id of ids){const raw=ships.find(s=>s.id===id)!,s=e.ships.find(s=>s.spec.id===id)!;
  expect(s.spec.hull).toBe(Math.round(raw.hull*hullRetention(raw.length)));expect(s.hull).toBe(s.spec.hull);
  expect(s.spec.shield).toBe(raw.shield);expect(s.shield).toBe(raw.shield);expect(s.spec.encounterTuning?.damage).toBe(tuning.bossDamage);
  expect(s.spec.mounts.map(m=>m.damage)).toEqual(raw.mounts.map(m=>m.damage*fleet.weaponDamage));
  expect(s.spec.speed).toBe(raw.speed);expect(s.spec.collisionDamageMultiplier).toBe(fleet.collisionDamage);
 }
 expect(JSON.stringify(ships)).toBe(before);
});
test('all marked gun origins survive cache round trips; ventral Skylark gun and both paired Hyun sides are retained',()=>{
 for(const id of ids){const base=manifest.assets.find(a=>a.shipId===id) as ShipAsset;
  for(const [mid,point] of Object.entries(layouts.ships[id].mounts)){const m=base.mounts.find(m=>m.id===mid)!;expect({x:m.x,y:m.y,facing:m.facing}).toEqual(point);}
  const old={...structuredClone(base),turretLayoutVersion:0,mounts:base.mounts.map(m=>({...m,x:0,y:0}))};expect(upgradeCombat(old,base).mounts).toEqual(base.mounts);
 }
 const skylark=ships.find(s=>s.id==='skylark')!;expect(Math.abs(skylark.mounts.find(m=>m.id==='laser-3')!.x)).toBeLessThan(.01);
 const hyun=ships.find(s=>s.id==='hyun')!.mounts.filter(m=>m.kind==='laser');expect(hyun.filter(m=>m.x>0)).toHaveLength(2);expect(hyun.filter(m=>m.x<0)).toHaveLength(2);
});
test('newer-version source records cannot silently replace the archived donor of existing incomplete ships',()=>{
 expect(analogue({id:'fury'},'shieldCapacity')?.id).toBe('pitbull');expect(analogue({id:'fury-mx'},'shieldCapacity')?.id).toBe('pitbull');
});

import {expect,test} from 'vitest';
import data from '../src/data/ships.json';
import facts from '../src/data/ship-reference-facts.json';
import values from '../src/data/ship-game-values.json';
import config from '../src/data/ship-game-balance.json';
import manifest from '../public/assets/ships/manifest.json';
import {BattleEngine} from '../src/sim/engine';
import {bossDefense} from '../src/sim/balance';
import {shipMass,shipImpact} from '../src/sim/collisions';
import {upgradeCombat,type ShipAsset} from '../src/assets/library';
import type {ShipSpec,WeaponKind} from '../src/sim/types';
const ships=data as ShipSpec[],find=(id:string)=>ships.find(s=>s.id===id)!;
test('physical facts and game conversions cover every model, without inventing missing capital shield sizes',()=>{
 expect(Object.keys(facts.ships)).toHaveLength(224);expect(Object.keys(values.ships)).toHaveLength(224);
 expect(facts.snapshotVersion).toBe('4.10.2-LIVE.12913470');
 expect(facts.ships.polaris.facts.length).toBe(181);expect(facts.ships.polaris.facts.mass).toBe(10427000);
 expect(facts.ships.caterpillar.facts.length).toBe(111.5);expect(find('caterpillar').length).toBe(111.5);expect(values.ships.caterpillar.estimated).not.toContain('length:source-conflict');
 expect(facts.ships.polaris.shields[0].status).toBe('ambiguous-model');expect(facts.ships.polaris.shields[0].capacityRange).toEqual([360000,648000]);
 expect('shieldCapacity' in facts.ships.odin.facts).toBe(false);expect(values.ships.odin.estimated).toContain('shieldCapacity');
 for(const ship of ships){expect(ship.statVersion).toBe(config.combatVersion);expect(ship.mass).toBeGreaterThan(0);expect(Number.isFinite(ship.speed+ship.acceleration+ship.turnRate+ship.hull+ship.shield)).toBe(true);}
});
test('the same physical data use the same conversion for a member or boss, with continuous health scaling',async()=>{
 const {convertShipFacts}=await import('../scripts/ship-stat-model.mjs');
 const source=structuredClone(facts.ships.polaris),member=convertShipFacts({...source,id:'member'}),boss=convertShipFacts({...source,id:'boss'});
 expect(member).toEqual(boss);
 const nearby=[630000,639999,640000,640001,650000].map(hullTotal=>convertShipFacts({...source,facts:{...source.facts,hullTotal}}).hull);
 expect(nearby).toEqual([...nearby].sort((a,b)=>a-b));expect(nearby[3]-nearby[1]).toBeLessThanOrEqual(2);
 for(const id of ['mauler','odin','pegasus','bengal','retribution']){const ship=find(id);expect(bossDefense(ship,'brawl',[],32,1)).toEqual({hull:ship.hull,shield:ship.shield,shieldRegen:ship.shieldRegen});}
});
function impact(kind:WeaponKind,shield=0){
 const owner={...structuredClone(find('gladius')),id:'owner',mounts:[],speed:0,acceleration:0,turnRate:0},target={...owner,id:'target',hull:10000,shield,shieldRegen:0,armorPhysicalMultiplier:.75,armorEnergyMultiplier:.6};
 const e=new BattleEngine();e.reset([{specId:owner.id,count:1},{specId:target.id,count:1}],[owner,target],42);e.asteroids=[];e.start();e.ships[0].npc='boss';
 const t=e.ships[1];e.projectiles=[{id:999,owner:e.ships[0].id,target:t.id,kind,x:t.x,y:t.y,vx:1,vy:0,angle:0,speed:1,damage:100,ttl:1,travel:0,range:1000,color:0xffffff}];e.step();return t;
}
test('source armor modifies only weapon overflow into hull, never shield absorption; collisions retain the existing low-speed limits',()=>{
 expect(impact('laser',50).shield).toBe(0);expect(impact('laser',50).hull).toBeCloseTo(9970);
 expect(impact('ballistic',50).shield).toBeCloseTo(25);expect(impact('ballistic',50).hull).toBeCloseTo(9943.75);expect(impact('laser',200).shield).toBeCloseTo(100);expect(impact('laser',200).hull).toBe(10000);
 const e=new BattleEngine();e.reset([{specId:'gladius',count:1},{specId:'polaris',count:1}],ships,42);const [a,b]=e.ships;
 expect(shipMass(a)).toBe(a.spec.mass);expect(shipMass(b)).toBe(b.spec.mass);expect(shipImpact(a,b,(a.spec.speed+b.spec.speed)*.2).a).toBe(0);expect(shipImpact(a,b,200).ordinaryA).toBeLessThanOrEqual(a.spec.hull*.05);
});
test('stock cached length follows the new source version while calibrated or custom artwork keeps its geometry',()=>{
 const builtin=manifest.assets.find(s=>s.shipId==='polaris') as ShipAsset,old={...structuredClone(builtin),length:166,beam:83.498,combatVersion:13};
 expect(upgradeCombat(old,builtin).length).toBe(181);expect(upgradeCombat({...old,calibrated:true},builtin).length).toBe(166);
 expect(upgradeCombat({...old,url:'assets/ships/custom.png'},builtin).length).toBe(166);
});

import {expect,test} from 'vitest';
import data from '../src/data/ships.json';
import {BattleEngine,STEP} from '../src/sim/engine';
import {simulationSeconds,battleSeconds} from '../src/sim/pacing';
import {chargeDamageMultiplier,chooseChargeGoal} from '../src/sim/charged-weapon';
import type {ShipSpec} from '../src/sim/types';
import manifest from '../public/assets/ships/manifest.json';
import {upgradeCombat,type ShipAsset} from '../src/assets/library';
import {drawWeaponEffects} from '../src/render/WeaponEffects';
import type {CombatVfx} from '../src/render/CombatVfx';
import type {Graphics} from 'pixi.js';

const find=(id:string)=>data.find(s=>s.id===id)! as ShipSpec;
function fixture(){
 const source={...structuredClone(find('idris-m')),mounts:structuredClone(find('idris-m').mounts.filter(m=>m.kind==='railgun')),speed:0,acceleration:0,turnRate:.6};
 const target={...structuredClone(find('hammerhead')),id:'target',mounts:[],speed:0,acceleration:0,turnRate:0,hull:1e9,shield:0,shieldRegen:0,armorPhysicalMultiplier:1};
 const e=new BattleEngine();e.reset([{specId:source.id,count:1},{specId:target.id,count:1}],[source,target],118);e.asteroids=[];
 e.ships.forEach((s,i)=>{s.x=i*2000;s.y=0;s.heading=0;s.vx=s.vy=0;s.cooldowns.fill(0);});e.start();return e;
}
function charge(e:BattleEngine,seconds:number){
 for(let n=0;n<180&&!(e.ships[0].weaponCycles?.[0].chargeLeft!>=0);n++)e.step();
 const owner=e.ships[0],cycle=owner.weaponCycles![0];expect(cycle.chargeLeft).toBeGreaterThan(0);cycle.chargeGoal=simulationSeconds(seconds);return e.time;
}
function release(e:BattleEngine){for(let i=0;i<300&&!e.shots;i++)e.step();expect(e.shots).toBe(1);return e.projectiles[0];}

test('longer charge continuously increases one projectile budget, stops at full charge, and spends only one round',()=>{
 const hits=[];
 for(const seconds of [.8,1.6,2.4]){
  const e=fixture(),start=charge(e,seconds),owner=e.ships[0],m=owner.spec.mounts[0],before=owner.weaponCycles![0].ammoLeft!,p=release(e),elapsed=e.time-start;
  expect(p.damage/m.damage).toBeCloseTo(chargeDamageMultiplier(m,elapsed),6);hits.push(p.damage);
  expect(owner.weaponCycles![0].ammoLeft).toBe(before-1);expect(owner.weaponCycles![0].chargeLeft).toBe(-1);
  expect(battleSeconds(Math.min(elapsed,m.charge!)+owner.cooldowns[0])).toBeCloseTo(10,5); // Short charging cannot bypass the sourced cycle; full charge may round by one fixed step.
  expect(p.speed).toBeCloseTo(939*.75*.65);expect(p.weaponId).toBe(m.weaponId);
 }
 expect(hits[0]/144160).toBeCloseTo(.75,1);expect(hits[1]).toBeGreaterThan(hits[0]);expect(hits[2]/144160).toBeCloseTo(1.5);
 const m=find('idris-m').mounts[0];expect(chargeDamageMultiplier(m,simulationSeconds(100))).toBe(1.5);
});
test('full charge remains visibly ready while waiting for the nose; cancelling or switching targets requires a fresh charge',()=>{
 const e=fixture();charge(e,2.4);const owner=e.ships[0],cycle=owner.weaponCycles![0],m=owner.spec.mounts[0],target=e.ships[1];
 const glow:number[][]=[],vfx={glow:(...args:number[])=>glow.push(args)} as unknown as CombatVfx;
 cycle.chargeLeft=0;cycle.chargeGoal=m.charge;
 drawWeaponEffects(e,{} as Graphics,1,vfx);expect(glow).toHaveLength(2);expect(glow[1][4]).toBe(.9);
 // A new target appears in the same direction after the first moves out of range.
 target.x=100000;const replacement={...structuredClone(target),id:3,x:2000};e.ships.push(replacement);owner.targetId=3;owner.searchAt=Infinity;
 e.step();expect(e.shots).toBe(0);expect(cycle.chargeLeft).toBe(-1);expect(cycle.chargeTarget).toBeUndefined();glow.length=0;
 drawWeaponEffects(e,{} as Graphics,1,vfx);expect(glow).toHaveLength(0);
 const start=charge(e,.8);expect(cycle.chargeTarget).toBe(3);release(e);expect(battleSeconds(e.time-start)).toBeGreaterThanOrEqual(.8);
});
test('a fully charged gun can wait through an aiming obstruction without hiding or firing at the selected target',()=>{
 const e=fixture();charge(e,2.4);const owner=e.ships[0],cycle=owner.weaponCycles![0];cycle.chargeLeft=0;cycle.chargeGoal=owner.spec.mounts[0].charge;owner.cooldowns[0]=1;
 for(let i=0;i<20;i++)e.step();expect(cycle.chargeLeft).toBe(0);expect(e.shots).toBe(0);expect(e.hits).toBe(0);
 const glows:number[][]=[];drawWeaponEffects(e,{} as Graphics,1,{glow:(...args:number[])=>glows.push(args)} as unknown as CombatVfx);expect(glows).toHaveLength(2);
});
test('pausing freezes charge and ammunition; losing the firing target cancels it and reset clears the state',()=>{
 const e=fixture();charge(e,2.4);for(let i=0;i<20;i++)e.step();e.pause();const before=JSON.stringify(e.ships[0].weaponCycles);for(let i=0;i<180;i++)e.step();expect(JSON.stringify(e.ships[0].weaponCycles)).toBe(before);expect(e.shots).toBe(0);
 e.pause();e.ships[1].x=100000;e.step();expect(e.ships[0].weaponCycles![0].chargeLeft).toBe(-1);expect(e.ships[0].weaponCycles![0].chargeGoal).toBeUndefined();
 e.reset([{specId:'idris-m',count:1},{specId:'hammerhead',count:1}],[find('idris-m'),find('hammerhead')],118);expect(e.ships[0].weaponCycles).toBeUndefined();
});
test('the charged shell stays on the actual nose heading and a target can evade after launch without taking selected-target damage',()=>{
 const e=fixture();charge(e,1.6);const p=release(e),angle=p.angle,vx=p.vx,vy=p.vy,target=e.ships[1],health=target.hull;
 expect(angle).toBeCloseTo(e.ships[0].heading);expect(p.kind).toBe('railgun');target.vy=450;
 for(let i=0;i<210;i++)e.step();expect(p.angle).toBe(angle);expect(p.vx).toBe(vx);expect(p.vy).toBe(vy);expect(target.hull).toBe(health);expect(e.hits).toBe(0);
});
test('hull aim observes with delay instead of reading perfect lead at every frame; a new short charge cannot retarget around the hull',()=>{
 const e=fixture();charge(e,2.4);const owner=e.ships[0],target=e.ships[1];
 const states=(e as unknown as {beamTurns:Map<number,{aimAt:number;aimAngle:number}>}).beamTurns,state=states.get(owner.id)!;
 while(state.aimAt-e.time<simulationSeconds(.12))e.step();const goal=state.aimAngle,heading=owner.heading;
 target.vy=300;for(let i=0;i<Math.floor(simulationSeconds(.1)/STEP);i++)e.step();expect(state.aimAngle).toBe(goal);expect(Math.abs(owner.heading-heading)).toBeLessThan(.001);expect(e.shots).toBe(0);
});
test('charge selection is varied and cannot exceed a shorter imported mount maximum; only Idris M stock cache upgrades',()=>{
 const e=fixture(),[s,t]=e.ships,m=s.spec.mounts[0],goals=[.1,.5,.9].map(v=>chooseChargeGoal(m,s,t,()=>v));expect(new Set(goals).size).toBe(3);
 const short={...m,charge:simulationSeconds(1)};expect(chooseChargeGoal(short,s,t,()=>1)).toBeLessThanOrEqual(short.charge);
 const builtin=manifest.assets.find(a=>a.shipId==='idris-m') as ShipAsset,old={...structuredClone(builtin),combatVersion:17,mounts:builtin.mounts.map(m=>m.kind==='railgun'?{...m,speed:704.25,charge:1.6}:m)};
 const upgraded=upgradeCombat(old,builtin),gun=upgraded.mounts.find(m=>m.kind==='railgun')!;expect(builtin.combatVersion).toBe(20);expect(gun.speed).toBeCloseTo(457.7625);expect(gun.charge).toBeCloseTo(3.2);expect(gun.damage).toBe(144160);expect(gun.ammo).toBe(1500);
});

import {expect,test} from 'vitest';
import data from '../src/data/ships.json';
import fleetRules from '../src/data/fleet-gameplay-balance.json';
import encounterRules from '../src/data/fleet-combat-tuning.json';
import {prepareCombatSpecs,hullRetention,torpedoSpeed} from '../src/sim/combat-tuning';
import {BattleEngine} from '../src/sim/engine';
import {shipImpact,SHIP_IMPACT_LIMIT} from '../src/sim/collisions';
import type {ShipSpec} from '../src/sim/types';
const raw=data as ShipSpec[],fleet={...fleetRules,enabled:true},off={...encounterRules,enabled:false};
test('size-based hull reduction is continuous, bounded and does not reduce small craft',()=>{
 expect(hullRetention(10,fleet)).toBe(1);expect(hullRetention(40,fleet)).toBe(1);
 let previous=1;for(let length=1;length<=3000;length++){const value=hullRetention(length,fleet);expect(value).toBeLessThanOrEqual(previous);expect(value).toBeGreaterThanOrEqual(.6);previous=value;}
 for(const boundary of [40,100,200,400])expect(Math.abs(hullRetention(boundary-.001,fleet)-hullRetention(boundary+.001,fleet))).toBeLessThan(.00002);
 expect(hullRetention(100,fleet)).toBeCloseTo(.840824);expect(hullRetention(200,fleet)).toBeCloseTo(.720412);expect(hullRetention(400,fleet)).toBe(.6);
});
test('shared conversion preserves raw facts, shields, rates, ammo, mounts, mobility and engine ports',()=>{
 const before=JSON.stringify(raw),converted=prepareCombatSpecs(raw,off,fleet);
 converted.forEach((spec,i)=>{
  const source=raw[i],{hull,mounts,collisionDamageMultiplier,...rest}=spec;
  const {hull:oldHull,mounts:oldMounts,...oldRest}=source;expect(rest).toEqual(oldRest);
  expect(hull).toBe(Math.round(oldHull*hullRetention(source.length,fleet)));expect(collisionDamageMultiplier).toBe(1.2);
  mounts.forEach((m,j)=>{const{damage,speed,...properties}=m,{damage:original,speed:sourceSpeed,...sourceProperties}=oldMounts[j];expect(properties).toEqual(sourceProperties);expect(speed).toBeCloseTo(m.kind==='torpedo'&&m.weaponSize?torpedoSpeed(m.weaponSize,fleet):sourceSpeed);expect(damage).toBeCloseTo(original*fleet.weaponDamage);});
 });
 expect(JSON.stringify(raw)).toBe(before);expect(prepareCombatSpecs(raw,off,{...fleet,enabled:false})).toBe(raw);
});
test('all member and boss torpedoes follow one strictly decreasing size-speed curve without changing other projectile speeds',()=>{
 const speeds=[5,9,10,12].map(size=>torpedoSpeed(size,fleet));for(let i=1;i<speeds.length;i++)expect(speeds[i]).toBeLessThan(speeds[i-1]);
 expect(speeds[0]).toBe(420);expect(speeds[2]).toBeLessThan(202.5);
});
test('the same weapon increase and size curve apply to members, bounty bosses and challenge bosses',()=>{
 const specs=prepareCombatSpecs(raw,off,fleet),base=raw.find(s=>s.id==='mauler')!;
 for(const mode of ['bounty','challenge'] as const){
  const e=new BattleEngine();e.reset([{specId:'mauler',count:1},{specId:'gladius',count:1},{specId:'mauler',count:1,npc:'boss'}],specs,31,mode);e.start();
  const member=e.ships.find(s=>s.spec.id==='mauler'&&!s.npc)!,boss=e.snapshot().boss!;
  expect(boss.spec.hull).toBe(member.spec.hull);expect(boss.spec.hull).toBe(Math.round(base.hull*.6));
  expect(boss.spec.mounts).toEqual(member.spec.mounts);expect(boss.spec.mounts[0].damage).toBeCloseTo(base.mounts[0].damage*fleet.weaponDamage);
  expect(boss.spec.collisionDamageMultiplier).toBe(member.spec.collisionDamageMultiplier);
 }
});
test('shared collision gain preserves low-speed immunity and the ordinary cap without limiting high-energy rams',()=>{
 const specs=prepareCombatSpecs(raw,off,fleet),e=new BattleEngine();e.reset([{specId:'arrow',count:2}],specs,31);const[a,b]=e.ships;
 const oldA={...a,spec:{...a.spec,collisionDamageMultiplier:1}},oldB={...b,spec:{...b.spec,collisionDamageMultiplier:1}};
 expect(shipImpact(a,b,80).a).toBe(0);expect(shipImpact(a,b,150).a).toBeCloseTo(shipImpact(oldA,oldB,150).a*1.2);
 const fast=shipImpact(a,b,1000);expect(fast.ordinaryA).toBe(a.spec.hull*SHIP_IMPACT_LIMIT);expect(fast.fatalA).toBe(true);expect(fast.severeA).toBeGreaterThan(a.hull);
});

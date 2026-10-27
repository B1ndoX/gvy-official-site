import {expect,test} from 'vitest';
import data from '../src/data/ships.json';
import {BattleEngine} from '../src/sim/engine';
import {trafficVelocity} from '../src/sim/traffic-avoidance';
import {attackNavigation} from '../src/sim/maneuver';
import {prepareCombatSpecs} from '../src/sim/combat-tuning';
import type {ShipSpec} from '../src/sim/types';
const source=data as ShipSpec[];
function pair(a='asgard',b='valkyrie',seed=42){const specs=prepareCombatSpecs(source).map(s=>({...s,mounts:s.mounts.map(m=>({...m,damage:0})),shieldRegen:0}));const e=new BattleEngine();e.reset([{specId:a,count:1},{specId:b,count:1}],specs,seed);e.asteroids=[];e.ships.forEach((s,i)=>{s.x=i?500:-500;s.y=0;s.heading=i?Math.PI:0;s.vx=(i?-1:1)*s.spec.speed;s.vy=0;});e.start();return e;}
test('head-on craft select reciprocal world-side lanes early and retain their chosen side',()=>{
 const e=pair(),[a,b]=e.ships;a.x=-250;b.x=250;
 const va=trafficVelocity(a,e.ships,{x:a.spec.speed,y:0}),vb=trafficVelocity(b,e.ships,{x:-b.spec.speed,y:0});
 expect(Math.abs(va.y)).toBeGreaterThan(10);expect(va.y*vb.y).toBeLessThan(0);
 a.vy=va.y*.4;b.vy=vb.y*.4;expect(trafficVelocity(a,e.ships,{x:a.spec.speed,y:0}).y*va.y).toBeGreaterThan(0);
});
test('clear crossing lanes and separating ships do not trigger a phantom avoidance',()=>{
 const e=pair(),[a,b]=e.ships;b.y=600;const wanted={x:a.spec.speed,y:0};expect(trafficVelocity(a,e.ships,wanted)).toEqual(wanted);
 b.y=0;a.vx=-100;b.vx=100;expect(trafficVelocity(a,e.ships,{x:-100,y:0})).toEqual({x:-100,y:0});
});
test('small and medium head-on duels do not grind their hulls away through repeated contact',()=>{
 for(const ids of [['asgard','valkyrie'],['gladius','arrow'],['cutlass-black','asgard']] as const)for(const seed of [21,42,77]){
  const e=pair(ids[0],ids[1],seed),initial=e.ships.map(s=>s.hull);for(let i=0;i<60*60&&e.phase==='running';i++)e.step();
  expect(e.ships.every(s=>s.alive)).toBe(true);e.ships.forEach((s,i)=>expect(s.hull/initial[i]).toBeGreaterThan(.9));
 }
});
test('a turret salvage ship translates through a broadside lane instead of indefinitely retreating to maximum range',()=>{
 const e=pair('asgard','reclaimer'),[small,large]=e.ships;large.x=0;small.x=-600;small.vx=small.vy=large.vx=large.vy=0;large.heading=Math.PI;
 const move=attackNavigation(large,small,10,undefined)!;
 expect(Math.abs(move.velocity!.y)).toBeGreaterThan(large.spec.speed*.05);expect(move.velocity!.x).toBeLessThanOrEqual(large.spec.speed*.12);
 const ship={...small,x:-500,vx:0,vy:0},target={...large,vx:large.spec.speed,vy:0},first=attackNavigation(ship,target,0,undefined)!,second=attackNavigation(ship,{...target,vx:0},0,undefined)!;
 expect(Math.abs(first.velocity!.x-second.velocity!.x)).toBeLessThan(large.spec.speed*.7);
});

import {expect,test} from 'vitest';
import data from '../src/data/ships.json';
import {BattleEngine} from '../src/sim/engine';
import {attackNavigation} from '../src/sim/maneuver';
import {randomGenerator} from '../src/sim/math';
import type {ShipSpec} from '../src/sim/types';
const specs=data as ShipSpec[];
function setup(seed=31){
 const a={...structuredClone(specs.find(s=>s.id==='idris-p')!) as ShipSpec,mounts:[],shieldRegen:0};
 const b={...structuredClone(specs.find(s=>s.id==='mauler')!) as ShipSpec,mounts:[],speed:0,acceleration:0,turnRate:0,shieldRegen:0};
 const e=new BattleEngine();e.reset([{specId:a.id,count:1},{specId:b.id,count:1}],[a,b],seed);e.asteroids=[];
 e.ships.forEach((s,i)=>{s.x=i*350;s.y=0;s.heading=i?Math.PI:0;s.vx=i?0:a.speed;s.vy=0;});e.start();return e;
}
test('a large hull initially driving nose-first into its boss moves laterally clear instead of remaining pinned',()=>{
 const e=setup(),s=e.ships[0],initial={x:s.x,y:s.y},health=s.hull+s.shield;
 for(let i=0;i<30*60;i++)e.step();
 expect(Math.abs(s.y-initial.y)).toBeGreaterThan(s.spec.length*.2);expect(Math.hypot(s.x-initial.x,s.y-initial.y)).toBeGreaterThan(s.spec.length*.5);expect(s.alive).toBe(true);expect(s.hull+s.shield).toBeGreaterThan(health*.9);
});
test('close capital escape decisions have a persistent lateral lane and differ across seeds',()=>{
 const e=setup(),[s,target]=e.ships,lanes=new Set<number>();
 for(let seed=1;seed<=16;seed++){
  const random=randomGenerator(seed*991),first=attackNavigation(s,target,0,undefined,false,random)!;lanes.add(Math.sign(first.velocity!.y));
  expect(first.state.phase).toBe('extend');expect(Math.abs(first.velocity!.y)).toBeGreaterThan(s.spec.speed*.4);
  const next=attackNavigation(s,target,10,first.state,false,random)!;expect(next.state.side).toBe(first.state.side);expect(next.state.phase).toBe('extend');
 }
 expect(lanes.size).toBe(2);
});
test('a heavy forward gun retains a lead solution while moving sideways and a quiet distant hull can approach',()=>{
 const e=setup(),[s,target]=e.ships;s.spec.mounts=[structuredClone(specs.find(s=>s.id==='idris-m')!.mounts[0])];target.vy=60;
 const close=attackNavigation(s,target,0,undefined)!;expect(close.heading).toBeGreaterThan(0);expect(Math.abs(close.velocity!.y)).toBeGreaterThan(0);
 s.x=-1600;s.y=0;s.vx=s.vy=0;target.vx=target.vy=0;const far=attackNavigation(s,target,100,undefined)!;expect(far.state.phase).toBe('approach');expect(far.velocity!.x).toBeGreaterThan(0);
});

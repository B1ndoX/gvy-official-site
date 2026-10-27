import {expect,test} from 'vitest';
import data from '../src/data/ships.json';
import {BattleEngine} from '../src/sim/engine';
import {firingObstacle,terrainCourse} from '../src/sim/terrain-navigation';
import {mountWorld,randomGenerator} from '../src/sim/math';
import type {ShipSpec} from '../src/sim/types';
import {prepareCombatSpecs} from '../src/sim/combat-tuning';
const find=(id:string)=>structuredClone(data.find(s=>s.id===id)!) as ShipSpec;
function fixture(moving=false,seed=31){
 const a=find('gladius'),b=find('hammerhead');
 a.mounts=[{...find('perseus').mounts.find(m=>m.fireControl==='pilot'&&m.kind==='ballistic')!,x:0,y:-.4,damage:1,ammo:200,cooldown:.1,range:3000}];
 if(!moving){a.speed=0;a.acceleration=0;a.turnRate=0;}
 b.mounts=[];b.speed=b.acceleration=b.turnRate=b.shieldRegen=0;b.hull=1e9;
 const e=new BattleEngine();e.reset([{specId:a.id,count:1},{specId:b.id,count:1}],[a,b],seed);
 e.ships.forEach((s,i)=>{s.x=i?500:-500;s.y=0;s.heading=i?Math.PI:0;s.vx=s.vy=0;s.cooldowns.fill(0);});e.asteroids=[{id:1,x:0,y:0,radius:140,rotation:0}];e.start();return e;
}
test('terrain blocks firing without spending ammunition; firing resumes when the lane opens',()=>{
 const e=fixture();for(let i=0;i<180;i++)e.step();expect(e.shots).toBe(0);expect(e.ships[0].weaponCycles![0].ammoLeft).toBe(200);
 e.asteroids=[];for(let i=0;i<60;i++)e.step();expect(e.shots).toBeGreaterThan(0);expect(e.ships[0].weaponCycles![0].ammoLeft).toBeLessThan(200);
});
test('a small ship goes around a screening rock and reaches a real firing opportunity instead of shooting it forever',()=>{
 for(const seed of [1,31,77]){
  const e=fixture(true,seed),s=e.ships[0];let lateral=0;
  for(let i=0;i<1200;i++){e.step();lateral=Math.max(lateral,Math.abs(s.y));}
  expect(lateral).toBeGreaterThan(140);expect(e.hits).toBeGreaterThan(0);expect(s.alive).toBe(true);
 }
});
test('passing side is persistent and seeded, clears when visible, and ignores a rock behind the target hull',()=>{
 const e=fixture(true),[s,t]=e.ships,origin=mountWorld(s,s.spec.mounts[0]),sides=new Set<number>();
 for(let seed=1;seed<=12;seed++){
  const rng=randomGenerator(seed*991),first=terrainCourse(s,t,origin,e.asteroids,undefined,rng)!;sides.add(first.state.side);
  const next=terrainCourse(s,t,origin,e.asteroids,first.state,()=>{throw Error('must not reroll a passing lane');})!;expect(next.state.side).toBe(first.state.side);
 }
 expect(sides.size).toBe(2);expect(terrainCourse(s,t,origin,[],undefined,()=>0)).toBeNull();
 expect(firingObstacle(origin,t,t,[{id:9,x:t.x+30,y:t.y,radius:20,rotation:0}])).toBeNull();
 const before=e.time;e.pause();for(let i=0;i<60;i++)e.step();expect(e.time).toBe(before);
});
test('a bypass waypoint stays in world space when the enemy moves; reciprocal ships pass the rock on the same world side',()=>{
 const e=fixture(true),[s,t]=e.ships,from=mountWorld(s,s.spec.mounts[0]);
 const first=terrainCourse(s,t,from,e.asteroids,undefined,()=>.5,21)!;
 t.y=50;const next=terrainCourse(s,t,from,e.asteroids,first.state,()=>{throw Error('route must not reroll');},21)!;
 expect(next.state.waypoint).toEqual(first.state.waypoint);
 t.y=0;const reverse=terrainCourse(t,s,t,e.asteroids,undefined,()=>.5,21)!;expect(first.state.waypoint.y*reverse.state.waypoint.y).toBeGreaterThan(0);
});
test('the recorded Idris P / Kraken Privateer endgame clears the rock and keeps damaging hulls instead of circling behind full shields',()=>{
 for(const seed of [21,42,77]){
  const specs=prepareCombatSpecs(data as ShipSpec[]),e=new BattleEngine();e.reset([{specId:'idris-p',count:1},{specId:'kraken-privateer',count:1}],specs,seed);
  e.asteroids=[{id:1,x:0,y:0,radius:100,rotation:0}];e.ships.forEach((s,i)=>{s.x=i?400:-400;s.y=0;s.heading=i?Math.PI:0;s.vx=s.vy=0;});e.start();
  for(let i=0;i<120*60&&e.phase==='running';i++)e.step();
  expect(e.ships.some(s=>s.hull<s.spec.hull*.98)).toBe(true);expect(e.hits).toBeGreaterThan(100);
  expect(e.ships.every(s=>e.time-s.lastDealt<5)).toBe(true);
 }
});

test('a grazing muzzle ray does not cancel and recreate a bypass every tick',()=>{
 const e=fixture(true),[s,t]=e.ships,rock=e.asteroids[0];
 let route=terrainCourse(s,t,s,e.asteroids,undefined,()=>.5,42)!.state;
 const original=structuredClone(route.waypoint);
 for(let i=0;i<120;i++){
  const origin={x:s.x,y:320+(i%2?1:-1)};
  expect(firingObstacle(origin,t,t,e.asteroids)).toBeNull();
  const next=terrainCourse(s,t,origin,e.asteroids,route,()=>{throw Error('grazing must not reroll');},42)!;
  expect(next).not.toBeNull();expect(next.state.waypoint).toEqual(original);route=next.state;
 }
 expect(rock.radius).toBe(140); // navigation clearance never changes weapon geometry
 expect(terrainCourse(s,t,{x:s.x,y:600},e.asteroids,route,()=>.5,42)).toBeNull();
});
test('a second rock becoming the first visible blocker does not reverse an unfinished bypass',()=>{
 const e=fixture(true),[s,t]=e.ships,rocks=[{id:1,x:-200,y:0,radius:40,rotation:0},{id:2,x:100,y:0,radius:40,rotation:0}];
 const first=terrainCourse(s,t,s,rocks,undefined,()=>.5,42)!;
 expect(first.state.rock).toBe(1);
 const next=terrainCourse(s,t,{x:-100,y:0},rocks,first.state,()=>.5,42)!;
 expect(firingObstacle({x:-100,y:0},t,t,rocks)?.id).toBe(2);
 expect(next.state.waypoint).toEqual(first.state.waypoint);
});

test('recorded multi-rock deadlock states resume movement and real fire instead of flipping routes every tick',async()=>{
 const{localizedShips}=await import('../src/data/localized-ships'),{default:fixtures}=await import('./fixtures/terrain-deadlocks.json');
 const specs=prepareCombatSpecs(localizedShips);
 for(const row of fixtures){
  const e=new BattleEngine();e.reset(row.ships.map(s=>({specId:s.specId,count:1})),specs,row.seed);
  e.ships.forEach((s,i)=>Object.assign(s,row.ships[i]));e.time=row.time;e.arena=row.arena;e.asteroids=row.rocks;
  (e as unknown as {terrainLanes:Map<number,unknown>}).terrainLanes=new Map(row.lanes as [number,unknown][]);
  (e as unknown as {attackRuns:Map<number,unknown>}).attackRuns=new Map(row.attacks as [number,unknown][]);
  const start=e.ships.map(s=>({x:s.x,y:s.y}));e.start();let travelled=0;
  for(let i=0;i<60*60&&e.phase==='running';i++){e.step();travelled+=Math.hypot(e.ships[0].vx,e.ships[0].vy)/60;}
  expect(e.phase==='finished'||travelled>150).toBe(true);expect(e.hits).toBeGreaterThan(0);
  expect(e.phase==='finished'||e.ships.some((s,i)=>Math.hypot(s.x-start[i].x,s.y-start[i].y)>100)).toBe(true);
 }
},10000);

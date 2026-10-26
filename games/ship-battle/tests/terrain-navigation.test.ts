import {expect,test} from 'vitest';
import data from '../src/data/ships.json';
import {BattleEngine} from '../src/sim/engine';
import {firingObstacle,terrainCourse} from '../src/sim/terrain-navigation';
import {mountWorld,randomGenerator} from '../src/sim/math';
import type {ShipSpec} from '../src/sim/types';
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

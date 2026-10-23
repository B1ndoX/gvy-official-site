import{test,expect}from'vitest';
import data from'../src/data/ships.json';
import{BattleEngine}from'../src/sim/engine';
import{STEP}from'../src/sim/engine';
import{wrap}from'../src/sim/math';
import{simulationSeconds}from'../src/sim/pacing';
import type{ShipSpec}from'../src/sim/types';
function duel(id='idris-p'){
 const owner=structuredClone(data.find(s=>s.id===id)!) as ShipSpec,target=structuredClone(data.find(s=>s.id==='arrow')!) as ShipSpec;
 owner.mounts=owner.mounts.filter(m=>m.kind==='beam').map(m=>({...m,charge:0}));owner.speed=0;owner.acceleration=0;owner.shieldRegen=0;
 target.id='moving-target';target.mounts=[];target.speed=0;target.acceleration=0;target.turnRate=0;target.hull=1e8;target.shield=0;target.shieldRegen=0;
 const e=new BattleEngine();e.reset([{specId:owner.id,count:1},{specId:target.id,count:1}],[owner,target],42);e.asteroids=[];
 e.ships.forEach((s,i)=>{s.x=i*1500;s.y=0;s.heading=0;s.cooldowns.fill(0)});e.start();e.step();expect(e.beams).toHaveLength(1);return e;
}
test.each(['idris-p','tiburon','mauler','odin'])('%s lateral movement escapes the continuous beam instead of remaining magnetically tracked',id=>{
 const e=duel(id),[owner,target]=e.ships;let miss=false;
 for(let i=0;i<80;i++){target.y+=5;target.vy=300;e.step();if(i>30&&e.beams[0]?.segments.every(s=>!s.hit))miss=true;}
 expect(owner.targetId).toBe(target.id);expect(miss).toBe(true);
 expect(Math.abs(wrap(Math.atan2(target.y-owner.y,target.x-owner.x)-owner.heading))).toBeGreaterThan(.01);
});
test('firing retains 80% maximum turn rate with a bounded acceleration, and reverses gradually',()=>{
 const e=duel(),[owner,target]=e.ships,rate=owner.spec.turnRate*.8,acceleration=rate/simulationSeconds(.2);target.y=1000;
 let previous=0,peak=0;for(let i=0;i<30;i++){const heading=owner.heading;e.step();const velocity=wrap(owner.heading-heading)/STEP;expect(Math.abs(velocity)).toBeLessThanOrEqual(rate+1e-8);expect(Math.abs(velocity-previous)).toBeLessThanOrEqual(acceleration*STEP+1e-8);peak=Math.max(peak,velocity);previous=velocity;}
 expect(peak).toBeCloseTo(rate,6);target.y=-1000;const heading=owner.heading;e.step();expect(wrap(owner.heading-heading)/STEP).toBeGreaterThan(0);
});
test('normal aiming and turning recover immediately after the beam ends, and reset drops its inertia',()=>{
 const e=duel(),[owner,target]=e.ships;target.y=1000;e.step();e.beams=[];target.y=-1000;const heading=owner.heading;e.step();expect(wrap(owner.heading-heading)).toBeCloseTo(-owner.spec.turnRate*STEP,6);
 const fresh=duel(),specs=fresh.ships.map(s=>s.spec);e.reset([{specId:specs[0].id,count:1},{specId:specs[1].id,count:1}],specs,42);e.asteroids=[];e.ships.forEach((s,i)=>{s.x=i*1500;s.y=0;s.heading=0;s.cooldowns.fill(0)});e.start();e.step();e.ships[1].y=1000;const before=e.ships[0].heading;e.step();expect(wrap(e.ships[0].heading-before)).toBeCloseTo(owner.spec.turnRate*.8/simulationSeconds(.2)*STEP*STEP,6);
});
test('pause freezes heading, beam lifetime and its damage settlement',()=>{
 const e=duel(),[owner,target]=e.ships;target.y=500;for(let i=0;i<10;i++)e.step();e.pause();const state={heading:owner.heading,remaining:e.beams[0].remaining,hits:e.hits};for(let i=0;i<120;i++)e.step();expect({heading:owner.heading,remaining:e.beams[0].remaining,hits:e.hits}).toEqual(state);
});

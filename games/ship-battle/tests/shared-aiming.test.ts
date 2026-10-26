import {expect,test} from 'vitest';
import data from '../src/data/ships.json';
import rules from '../src/data/aim-tracking-rules.json';
import {BattleEngine,STEP} from '../src/sim/engine';
import {simulationSeconds} from '../src/sim/pacing';
import {fixedWeapon,turretControlled} from '../src/sim/weapons';
import {wrap} from '../src/sim/math';
import type {ShipSpec,Mount} from '../src/sim/types';
const ships=data as ShipSpec[],find=(id:string)=>ships.find(s=>s.id===id)!;
function fixture(id:string,mounts:Mount[],boss:boolean,reference=true){
 const source={...structuredClone(find(id)),mounts:structuredClone(mounts),speed:0,acceleration:0,turnRate:.6},target={...structuredClone(find('arrow')),id:'target',mounts:[],speed:0,acceleration:0,turnRate:0,hull:1e9,shield:0,shieldRegen:0,armorEnergyMultiplier:1};
 const e=new BattleEngine(reference);e.reset([{specId:id,count:1},{specId:target.id,count:1}],[source,target],73);e.asteroids=[];e.ships.forEach((s,i)=>{s.x=i*1400;s.y=0;s.heading=0;s.cooldowns.fill(0);s.turretAngles.fill(0);});if(boss)e.ships[0].npc='boss';e.start();return e;
}
test('the catalog routes every manned/remote gun through shared tracking and keeps every pilot gun hull-fixed',()=>{
 let turrets=0;for(const s of ships)for(const m of s.mounts){if(m.interceptsOnly){expect(turretControlled(m)).toBe(false);continue;}if(m.fireControl==='manned'||m.fireControl==='remote'){expect(turretControlled(m)).toBe(true);expect(fixedWeapon(m)).toBe(false);turrets++;}if(m.fireControl==='pilot'){expect(turretControlled(m)).toBe(false);expect(fixedWeapon(m)).toBe(true);}}
 expect(turrets).toBeGreaterThan(300);
 const example=find('scorpius').mounts.find(m=>m.fireControl==='remote')!;expect(turretControlled({...example,fireControl:'pilot'})).toBe(false);expect(fixedWeapon({...example,fireControl:'pilot'})).toBe(true);
});
test.each(['idris-p','tiburon','mauler','odin'])('%s continuous beam uses the same sampled hull tracking for members and bosses and cannot follow a sudden sidestep',id=>{
 const headings:number[][]=[];
 for(const boss of [false,true]){
  const m={...find(id).mounts.find(m=>m.kind==='beam')!,charge:0,duration:10},e=fixture(id,[m],boss),s=e.ships[0],t=e.ships[1];e.step();expect(e.beams).toHaveLength(1);
  for(let i=0;i<60;i++)e.step();const health=t.hull;t.y=600;
  const curve:number[]=[];let previous=s.heading,velocity=0;
  const limit=s.spec.turnRate*rules.beamHullTurnFraction,acceleration=limit/simulationSeconds(rules.angularAccelerationSeconds);
  for(let i=0;i<Math.ceil(simulationSeconds(.2)/STEP);i++){e.step();const next=wrap(s.heading-previous)/STEP;expect(Math.abs(next)).toBeLessThanOrEqual(limit+1e-8);expect(Math.abs(next-velocity)).toBeLessThanOrEqual(acceleration*STEP+1e-8);curve.push(s.heading);previous=s.heading;velocity=next;}
  expect(t.hull).toBe(health); // A ray intersects its real line, not its selected target.
  headings.push(curve);
 }
 expect(headings[0]).toEqual(headings[1]);
});
test.each([true,false])('both active source and historical profile use gunner inertia even for a boss (reference=%s)',reference=>{
 const m=find('scorpius').mounts.find(m=>m.fireControl==='remote')!,e=fixture('scorpius',[m],true,reference),s=e.ships[0];e.ships[1].y=500;let previous=wrap(s.heading+s.turretAngles[0]);
 for(let i=0;i<120;i++){e.step();const next=wrap(s.heading+s.turretAngles[0]);expect(Math.abs(wrap(next-previous))).toBeLessThanOrEqual(m.turnRate*STEP+1e-8);previous=next;}
 expect(s.weaponCycles?.[0].aimTarget).toBe(e.ships[1].id);expect(s.weaponCycles?.[0].aimAt).toBeGreaterThan(e.time);
});

// Explicit regression of the retained balance layer; reference-mode tests are separate.
import {expect,test} from 'vitest';
import data from '../src/data/ships.json';
import {simulationSeconds,battleSeconds} from '../src/sim/pacing';
import {BattleEngine} from '../src/sim/engine';
import {battleRoster} from '../src/sim/members';
import type {Ship,ShipSpec} from '../src/sim/types';
const passive=(data as ShipSpec[]).map(s=>({...s,mounts:[],speed:0,acceleration:0,shieldRegen:0,armorPhysicalMultiplier:1,armorEnergyMultiplier:1}));
function barrage(e:BattleEngine,victim:Ship,owner:number){for(let n=0;n<20;n++)e.projectiles.push({id:9999+n,owner,target:victim.id,kind:'laser',x:victim.x,y:victim.y,vx:1250,vy:0,angle:0,speed:1250,damage:10000000,ttl:1,travel:0,range:1000,color:0xffffff});e.step();}
test('a full-health fighter survives a one-second capital barrage but sustained fire still destroys it',()=>{
  const e=new BattleEngine(false);e.reset([{specId:'gladius',count:3}],passive,21);e.ships.forEach((s,i)=>{s.x=i*1000;s.y=0;});e.start();const target=e.ships[0];
  for(let i=0;i<60;i++)barrage(e,target,2);
  expect(target.alive).toBe(true);expect(target.hull+target.shield).toBeGreaterThan((target.spec.hull+target.spec.shield)*.65);
  for(let i=0;i<420&&target.alive;i++)barrage(e,target,2);
  expect(target.alive).toBe(false);expect(e.time).toBeGreaterThan(5);expect(e.time).toBeLessThan(8);expect(e.ships[1].kills).toBe(1);
});
test('a challenge boss survives three wall-clock seconds at 4× even under unlimited incoming fire',()=>{
  const e=new BattleEngine(false);e.reset(battleRoster([{specId:'gladius',count:2}],'challenge',21),passive,21,'challenge');e.start();const boss=e.snapshot().boss!;
  for(let i=0;i<simulationSeconds(3,4)*60;i++)barrage(e,boss,1);
  expect(boss.alive).toBe(true);
  for(let i=0;i<20*60&&boss.alive;i++)barrage(e,boss,1);
  expect(boss.alive).toBe(false);expect(e.time).toBeGreaterThan(26);expect(e.time).toBeLessThan(30);
});

test('baseline duration is 25% shorter and published clock still matches speed',()=>{
  for(const speed of [1,2,4])expect(battleSeconds(simulationSeconds(10,speed))).toBeCloseTo(10*speed);
  const e=new BattleEngine(false);e.reset([{specId:'gladius',count:2}],passive,21);e.start();for(let i=0;i<80;i++)e.step();expect(e.snapshot().time).toBeCloseTo(1);
});

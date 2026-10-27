import {test,expect} from 'vitest';
import {BattleEngine} from '../src/sim/engine';
import {localizedShips} from '../src/data/localized-ships';
import {prepareCombatSpecs} from '../src/sim/combat-tuning';
import {asteroidContact,createAsteroids} from '../src/sim/asteroids';
import {BOSS_IDS} from '../src/sim/members';
const specs=prepareCombatSpecs(localizedShips);

test('ships keep their attack course through the old invisible boundary instead of cancelling into a stop',()=>{
 const quiet=specs.map(s=>({...s,mounts:[],shieldRegen:0,...(s.id==='arrow'?{speed:0,acceleration:0,turnRate:0}:{})})),e=new BattleEngine();
 e.reset([{specId:'idris-p',count:1},{specId:'arrow',count:1}],quiet,31);e.arena=3000;e.asteroids=[];
 const[s,t]=e.ships;Object.assign(s,{x:2730,y:0,heading:0,vx:0,vy:0});Object.assign(t,{x:6000,y:0,heading:0,vx:0,vy:0});e.start();
 for(let i=0;i<800;i++)e.step();expect(s.x-2730).toBeGreaterThan(500);expect(s.vx).toBeGreaterThan(s.spec.speed*.5);
});
test('every boss arrival starts outside asteroid hull contact and can navigate during its original weapon delay',()=>{
 const quiet=specs.map(s=>({...s,mounts:s.mounts.map(m=>({...m,damage:0}))}));
 for(const id of BOSS_IDS)for(const seed of [1,31,77]){
  const e=new BattleEngine();e.reset([{specId:'hammerhead',count:6},{specId:id,count:1,npc:'boss',team:'vanduul'}],quiet,seed,'bounty');e.start();
  const boss=e.ships.find(s=>s.npc==='boss')!;expect(e.asteroids.every(r=>!asteroidContact(boss,r,29))).toBe(true);
  let maxStep=0;
  for(let i=0;i<240;i++){const x=boss.x,y=boss.y;e.step();maxStep=Math.max(maxStep,Math.hypot(boss.x-x,boss.y-y));}
  expect(maxStep).toBeLessThan(20);
 }
},10000);
test('the twenty asteroids occupy a wider field with larger gaps, without a central pile',()=>{
 const e=new BattleEngine();e.reset([{specId:'gladius',count:2}],specs,31);const rocks=createAsteroids(e.ships,e.arena,31);
 expect(rocks).toHaveLength(20);expect(rocks.filter(r=>Math.hypot(r.x,r.y)>e.arena)).toHaveLength(8);
 for(const r of rocks){expect(Math.hypot(r.x,r.y)).toBeGreaterThan(e.arena*.12);for(const other of rocks)if(other!==r)expect(Math.hypot(r.x-other.x,r.y-other.y)-r.radius-other.radius).toBeGreaterThanOrEqual(Math.max(210,e.arena*.055));}
});
test('a blocked arrival lane cannot exhaust a fixed search budget and spawn a boss inside terrain',()=>{
 const e=new BattleEngine();e.reset([{specId:'gladius',count:2},{specId:'retribution',count:1,npc:'boss',team:'vanduul'}],specs,31,'bounty');
 e.ships.forEach((s,i)=>Object.assign(s,{x:i?100:-100,y:0,vx:0,vy:0}));
 (e as unknown as {random:()=>number}).random=()=>0;
 e.asteroids=Array.from({length:8},(_,i)=>({id:i+1,x:2200+i*600,y:0,radius:60,rotation:0}));
 e.start();const boss=e.snapshot().boss!;
 expect(boss.x).toBeGreaterThan(600+boss.radius+100+299*12);
 expect(e.asteroids.every(r=>!asteroidContact(boss,r,29))).toBe(true);
 const x=boss.x,y=boss.y;e.step();expect(Math.hypot(boss.x-x,boss.y-y)).toBeLessThan(20);
});

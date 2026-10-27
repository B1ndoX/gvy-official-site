import {expect,test} from 'vitest';
import data from '../src/data/ships.json';
import {BattleEngine} from '../src/sim/engine';
import {naturalShieldRecovery} from '../src/sim/shield-recovery';
import {simulationSeconds} from '../src/sim/pacing';
import {battleRoster} from '../src/sim/members';
import type {ShipSpec} from '../src/sim/types';

function setup(length=25,reference=true){
 const specs=(data as ShipSpec[]).map(s=>({...s,mounts:[],speed:0,acceleration:0,turnRate:0,hull:1e7,shield:1000,shieldRegen:1,length,shieldRecoveryDelay:.01,shieldDownDelay:999}));
 const e=new BattleEngine(reference);e.reset([{specId:'gladius',count:2}],specs,31);e.asteroids=[];e.ships.forEach((s,i)=>{s.x=i*1000;s.y=0;s.lastHit=0;});e.start();return e;
}
function step(e:BattleEngine,count:number){for(let i=0;i<count;i++)e.step();}
function hit(e:BattleEngine){const [s,owner]=e.ships;e.projectiles.push({id:999999,owner:owner.id,target:s.id,kind:'laser',x:s.x,y:s.y,vx:1200,vy:0,angle:0,speed:1200,damage:1,ttl:1,travel:0,range:1000,color:0xffffff});e.step();}

test('size curve has a 6-second small delay/3-second recharge and 100-metre 10-second recharge',()=>{
 const r=(length:number)=>naturalShieldRecovery({length,shield:1000,shieldRegen:1});
 expect(r(25).delaySeconds).toBe(6);expect(r(25).rechargeSeconds).toBe(3);expect(r(100).delaySeconds).toBe(10);expect(r(100).rechargeSeconds).toBe(10);
 expect(r(400).delaySeconds).toBe(14);expect(r(400).rechargeSeconds).toBe(17);expect(r(3000).rechargeSeconds).toBe(20);
 let prior=r(1);for(let length=2;length<=3000;length++){const next=r(length);expect(next.delaySeconds).toBeGreaterThanOrEqual(prior.delaySeconds);expect(next.rechargeSeconds).toBeGreaterThanOrEqual(prior.rechargeSeconds);expect(next.delaySeconds-prior.delaySeconds).toBeLessThan(.2);prior=next;}
 expect(naturalShieldRecovery({length:100,shield:1000,shieldRegen:0}).perSecond).toBe(0);
});

test('empty and partially depleted shields wait beyond the same full delay, then refill at the size rate',()=>{
 for(const reference of [true,false])for(const initial of [0,200]){
  const e=setup(25,reference),s=e.ships[0];s.shield=initial;
  step(e,simulationSeconds(6)*60);expect(s.shield).toBe(initial);
  e.step();expect(s.shield).toBeGreaterThan(initial);
  step(e,simulationSeconds(3)*60);expect(s.shield).toBe(1000);
 }
});

test('every real hit resets the delay; sustained attack over 20 seconds never permits passive recovery',()=>{
 const e=setup(),s=e.ships[0];s.shield=500;
 for(let burst=0;burst<4;burst++){step(e,simulationSeconds(5)*60);const before=s.shield;hit(e);expect(s.shield).toBeLessThan(before);}
 const after=s.shield;step(e,simulationSeconds(6)*60);expect(s.shield).toBe(after);e.step();expect(s.shield).toBeGreaterThan(after);
});

test('100-metre hull refills in ten battle seconds after its delay, and pause freezes recovery exactly',()=>{
 const e=setup(100),s=e.ships[0];s.shield=0;step(e,simulationSeconds(10)*60);expect(s.shield).toBe(0);
 e.pause();const time=e.time;step(e,2000);expect(e.time).toBe(time);expect(s.shield).toBe(0);e.pause();
 step(e,simulationSeconds(5)*60);expect(s.shield).toBeCloseTo(500,4);step(e,simulationSeconds(5)*60);expect(s.shield).toBeCloseTo(1000,4);
});

test('challenge wave supply remains an explicit bonus before natural recovery is eligible',()=>{
 const specs=(data as ShipSpec[]).map(s=>({...s,mounts:[],speed:0,acceleration:0,turnRate:0,shieldRegen:1})),e=new BattleEngine();
 e.reset(battleRoster([{specId:'gladius',count:2}],'challenge',31),specs,31,'challenge');e.start();
 const s=e.ships[0],boss=e.ships.find(s=>s.npc==='boss')!;s.shield=0;s.lastHit=0;boss.alive=false;boss.hull=boss.shield=0;
 for(let i=0;i<500&&e.wave===1;i++)e.step();
 expect(e.wave).toBe(2);expect(e.time).toBeLessThan(naturalShieldRecovery(s.spec).delay);expect(s.shield).toBeCloseTo(s.spec.shield*.35,6);
});

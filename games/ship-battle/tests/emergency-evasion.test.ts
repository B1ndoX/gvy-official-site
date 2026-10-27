import {expect,test} from 'vitest';
import data from '../src/data/ships.json';
import {BattleEngine} from '../src/sim/engine';
import {evasion,evasionVelocity,type Evasion} from '../src/sim/maneuver';
import {randomGenerator} from '../src/sim/math';
import type {ShipSpec} from '../src/sim/types';
function setup(id:string){const e=new BattleEngine();e.reset([{specId:id,count:1},{specId:'gladius',count:1}],data as ShipSpec[],31);const s=e.ships[0];s.hull=s.spec.hull*.05;s.lastHit=1;s.hitStreak={since:.8,last:1,count:3};return s;}
const waiting:Evasion={until:0,scanAt:100,side:1};
test.each(['gladius','vanguard-warden','perseus','polaris'])('%s can trigger its single critical escape even before the next scan',id=>{
 const s=setup(id),state=evasion(s,new Map(),[],1.1,waiting,randomGenerator(31)),velocity=evasionVelocity(s,0,state,1.1);
 expect(state.emergencyUntil).toBeGreaterThan(1.1);expect(velocity.boost).toBeGreaterThanOrEqual(s.spec.length<35?1.7:s.spec.length<100?1.4:1.22);expect(Math.hypot(velocity.x,velocity.y)).toBeGreaterThan(s.spec.speed*.3);expect(Math.abs(velocity.x*Math.cos(state.angle!)+velocity.y*Math.sin(state.angle!))).toBeLessThan(1e-8);
 const continuing=evasion(s,new Map(),[],1.2,state,randomGenerator(31));expect(continuing.until).toBe(state.until);expect(s.spec.speed).toBe((data as ShipSpec[]).find(x=>x.id===id)!.speed);
});
test('200m and larger hulls do not receive emergency acceleration; healthy hulls do not trigger it',()=>{
 for(const id of ['idris-p','javelin']){const s=setup(id);expect(evasion(s,new Map(),[],1.1,waiting)).toBe(waiting);}
 const s=setup('perseus');s.spec={...s.spec,length:200};expect(evasion(s,new Map(),[],1.1,waiting)).toBe(waiting);
 s.spec={...s.spec,length:100};s.hull=s.spec.hull*.7;expect(evasion(s,new Map(),[],1.1,waiting)).toBe(waiting);
});

test('critical flight maintains lateral momentum, does not reroll direction, and eases out after leaving fire',()=>{
 const s=setup('perseus');s.heading=0;s.vy=s.spec.speed*.4;
 const first=evasion(s,new Map(),[],1.1,{...waiting,scanAt:0},randomGenerator(31));expect(first.side).toBe(1);
 const next=evasion(s,new Map(),[],1.4,first,randomGenerator(999));expect(next.side).toBe(first.side);expect(next.until).toBeLessThanOrEqual(first.until);
 s.lastHit=0;s.hitStreak!.last=0;const safe=evasion(s,new Map(),[],2,first,randomGenerator(999));
 expect(safe.until).toBeLessThan(first.until);expect(safe.side).toBe(first.side);
 const expired=evasionVelocity(s,0,safe,safe.until+.1);expect(expired).toEqual({x:0,y:0,boost:1});
 const cooled=evasion(s,new Map(),[],2.1,safe,randomGenerator(2));expect(cooled.emergencyUsed).toBe(true);
});


test('ten percent triggers once without requiring a hit streak; remaining low, shield recovery and target changes do not rearm it',()=>{
 const s=setup('perseus');s.hitStreak=undefined;s.lastHit=-100;s.hull=s.spec.hull*.101;expect(evasion(s,new Map(),[],1.1,waiting)).toBe(waiting);
 s.hull=s.spec.hull*.1;const used=evasion(s,new Map(),[],1.1,waiting,randomGenerator(31));expect(used.emergencyUsed).toBe(true);
 s.targetId=99;s.shield=s.spec.shield;s.hull=s.spec.hull*.02;
 const repeated=evasion(s,new Map(),[],60.1,used,randomGenerator(1));expect(repeated.emergencyUsed).toBe(true);expect(repeated.emergencyUntil).toBe(used.emergencyUntil);
 s.hull=s.spec.hull*.1;expect(evasion(s,new Map(),[],70,repeated).emergencyUsed).toBe(true);
});

test.each(['brawl','teams','bounty','challenge'] as const)('%s rearms only after hull recovers above ten percent, then permits one new escape',mode=>{
 const e=new BattleEngine();e.reset([{specId:'perseus',count:1}],data as ShipSpec[],31,mode);const s=e.ships[0];s.hull=s.spec.hull*.09;
 const first=evasion(s,new Map(),[],1,waiting,randomGenerator(31));
 s.hull=s.spec.hull*.101;const recovered=evasion(s,new Map(),[],1.01,first);expect(recovered.emergencyUsed).toBe(false);expect(recovered.until).toBe(first.until);
 s.hull=s.spec.hull*.1;const second=evasion(s,new Map(),[],50,recovered,randomGenerator(31));expect(second.emergencyUsed).toBe(true);expect(second.emergencyUntil).toBeGreaterThan(50);
 const stillLow=evasion(s,new Map(),[],100,second);expect(stillLow.emergencyUntil).toBe(second.emergencyUntil);
});

test('shield absorption does not count as continuing hull loss for the low-health escape trigger',()=>{
 const specs=(data as ShipSpec[]).map(s=>({...s,mounts:[],speed:0,acceleration:0,turnRate:0,shieldRegen:0})),e=new BattleEngine();e.reset([{specId:'gladius',count:2}],specs,31);e.asteroids=[];e.ships.forEach((s,i)=>{s.x=i*1000;s.y=0;});e.start();const target=e.ships[0];target.hull=target.spec.hull*.05;target.shield=1000;
 const hit=()=>{e.projectiles.push({id:9999+e.hits,owner:2,target:1,kind:'laser',x:target.x,y:target.y,vx:1,vy:0,angle:0,speed:1,damage:10,ttl:1,travel:0,range:1000,color:0xffffff});e.step();};
 hit();hit();expect(target.hitStreak).toBeUndefined();target.shield=0;hit();hit();expect(target.hitStreak!.count).toBe(2);
});

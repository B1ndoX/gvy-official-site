import {expect,test} from 'vitest';
import data from '../src/data/ships.json';
import {evasion,evasionVelocity,handling} from '../src/sim/maneuver';
import {BattleEngine} from '../src/sim/engine';
import {battleRoster} from '../src/sim/members';
import type {ShipSpec} from '../src/sim/types';
const specs=(data as ShipSpec[]).map(s=>({...s,hull:s.hull*100,shield:s.shield*100,shieldRegen:0}));
test('a small ship turns toward a pursuer behind it instead of treating it as a completed attack pass',async()=>{
 const{attackNavigation}=await import('../src/sim/maneuver');
 const e=new BattleEngine();e.reset([{specId:'prowler',count:1},{specId:'herald',count:1}],data as ShipSpec[],77);const[s,t]=e.ships;
 Object.assign(s,{x:120,y:0,heading:0,vx:s.spec.speed,vy:0});Object.assign(t,{x:0,y:0,heading:0,vx:t.spec.speed,vy:0});
 const plan=attackNavigation(s,t,0,undefined);
 expect(plan.state.phase).toBe('approach');expect(plan.coast).toBe(false);expect(Math.cos(plan.heading)).toBeLessThan(0);
 s.heading=Math.PI;const facing=attackNavigation(s,t,1,plan.state);
 expect(facing.state.phase).toBe('strike');expect(facing.coast).toBe(false);
});
test('an escape can rejoin after completing its turn even when a pursuer prevents separation',async()=>{
 const{attackNavigation}=await import('../src/sim/maneuver');
 const e=new BattleEngine();e.reset([{specId:'prowler',count:1},{specId:'herald',count:1}],data as ShipSpec[],77);const[s,t]=e.ships;
 Object.assign(s,{x:0,y:0,heading:1.1,vx:Math.cos(1.1)*s.spec.speed,vy:Math.sin(1.1)*s.spec.speed});Object.assign(t,{x:-120*Math.cos(1.1),y:-120*Math.sin(1.1)});
 const prior={target:t.id,phase:'extend' as const,angle:0,side:1,motionAt:0};
 expect(attackNavigation(s,t,.5,prior).state.phase).toBe('extend');
 const rejoin=attackNavigation(s,t,2,prior);
 expect(rejoin.state.phase).toBe('approach');expect(rejoin.coast).toBe(false);
 expect(attackNavigation(s,t,2.1,rejoin.state).state.phase).toBe('approach');
});
test('engaged fighters keep moving laterally, change attack direction and still land shots',()=>{
 const e=new BattleEngine();e.reset([{specId:'gladius',count:2}],specs,21);e.ships.forEach((s,i)=>{s.x=i*700;s.y=0;s.heading=i?Math.PI:0;});e.start();
 let moving=0,forward=0,backward=0,samples=0;for(let i=0;i<45*60;i++){e.step();if(i>10*60){const a=e.ships[0],b=e.ships[1],dx=b.x-a.x,dy=b.y-a.y,cross=dx*a.vy-dy*a.vx;samples++;if(Math.hypot(a.vx,a.vy)>a.spec.speed*.08)moving++;if(cross>0)forward++;else backward++;}}
 expect(moving/samples).toBeGreaterThan(.8);expect(forward).toBeGreaterThan(60);expect(backward).toBeGreaterThan(60);expect(e.hits).toBeGreaterThan(0);
});
test('boss keeps manoeuvring after its initial entrance without immobilising the member fleet',()=>{
 const e=new BattleEngine();e.reset(battleRoster([{specId:'gladius',count:10}],'challenge',21),specs,21,'challenge');e.start();const boss=e.snapshot().boss!;let moving=0,travelled=0;
 for(let i=0;i<25*60;i++){const x=boss.x,y=boss.y;e.step();travelled+=Math.hypot(boss.x-x,boss.y-y);if(i>5*60&&Math.hypot(boss.vx,boss.vy)>boss.spec.speed*.08)moving++;}
 // A random curved course can return near its start while moving throughout.
 expect(travelled).toBeGreaterThan(boss.spec.speed*3);expect(moving).toBeGreaterThan(10*60);expect(e.hits).toBeGreaterThan(0);
});

test.each(['arrow','terrapin'])('%s keeps its combat course instead of automatically dodging each incoming volley',id=>{
 const e=new BattleEngine();e.reset([{specId:id,count:1},{specId:'idris-p',count:1}],specs,21);const [s,other]=e.ships;s.x=0;s.y=0;s.vx=0;s.vy=0;s.heading=0;const ships=new Map(e.ships.map(s=>[s.id,s]));
 const idle={until:0,scanAt:0,side:1},p={id:99,owner:other.id,target:s.id,kind:'laser' as const,x:500,y:0,vx:-1000,vy:0,angle:Math.PI,speed:1000,damage:10,ttl:1,travel:0,range:1000,color:0xffffff};
 for(const time of [1,8,16,32]){s.lastHit=time;s.hull=s.spec.hull*.5;const active=evasion(s,ships,[p],time,idle);expect(active).toBe(idle);expect(evasionVelocity(s,0,active,time)).toEqual({x:0,y:0,boost:1});}
 const capital={...s,spec:specs.find(s=>s.id==='javelin')!};expect(handling(capital).lateral).toBeLessThan(handling(s).lateral);expect(handling(capital).boost).toBeLessThan(handling(s).boost);
});

test('seeded bomber, interceptor and defensive-ship encounters resolve through combat without a prescribed winner',()=>{
 const original=data as ShipSpec[];
 for(const [a,b] of [['eclipse','javelin','eclipse'],['gladius','eclipse','gladius'],['hammerhead','eclipse','hammerhead']] as const){
  for(const seed of [1,2,3,4]){const e=new BattleEngine();e.reset([{specId:a,count:1},{specId:b,count:1}],original,seed);e.asteroids=[];e.ships.forEach((s,i)=>{s.x=i?650:-650;s.y=0;s.heading=i?Math.PI:0;});e.start();for(let i=0;i<600*60&&e.phase==='running';i++)e.step();expect(e.phase).toBe('finished');expect(e.hits).toBeGreaterThan(0);expect(e.ships.reduce((sum,s)=>sum+s.kills,0)+e.collisionDeaths).toBe(e.snapshot().destroyed);}
 }
},30000);

test('small ships keep firing safely until a threat or near-hull danger requires a curved evasive pass',async()=>{
 const{attackNavigation}=await import('../src/sim/maneuver');const e=new BattleEngine();e.reset([{specId:'gladius',count:1},{specId:'bengal',count:1}],specs,42);const [s,boss]=e.ships;s.x=1500;s.y=0;boss.x=boss.y=0;boss.heading=0;
 const first=attackNavigation(s,boss,0,undefined)!;expect(first.state.phase).toBe('approach');const lane=first.state.entry;
 boss.heading=Math.PI/2;expect(attackNavigation(s,boss,1,first.state)!.state.entry).toBe(lane);
 s.x=600;const attack=attackNavigation(s,boss,13,first.state)!;expect(attack.state.phase).toBe('strike');expect(attackNavigation(s,boss,120,attack.state)!.state.phase).toBe('strike');const exit=attackNavigation(s,boss,121,attack.state,true)!;expect(exit.state.phase).toBe('extend');expect(Math.abs(exit.velocity!.y)).toBeGreaterThan(s.spec.speed*.25);
 const entries=new Set(Array.from({length:12},(_,i)=>attackNavigation({...s,id:i+1},boss,0,undefined)!.state.entry));expect(entries.size).toBe(12);
});

test('a 32-member cooperative fleet can manoeuvre around its boss without early collision deaths',()=>{
 const safe=specs.map(s=>({...s,mounts:s.mounts.map(m=>({...m,damage:0}))})),e=new BattleEngine();e.reset(battleRoster([{specId:'gladius',count:32}],'challenge',42),safe,42,'challenge');e.asteroids=[];e.start();
 for(let i=0;i<45*60;i++)e.step();expect(e.snapshot().memberAlive).toBe(32);expect(e.collisionDeaths).toBe(0);expect(e.killLog).toHaveLength(0);expect(e.hits).toBeGreaterThan(0);
});

test('engagement choices vary by seed and re-entry, but the same seed remains reproducible',async()=>{
 const{attackNavigation}=await import('../src/sim/maneuver'),{randomGenerator}=await import('../src/sim/math');const e=new BattleEngine();e.reset([{specId:'gladius',count:1},{specId:'bengal',count:1}],specs,42);const [s,boss]=e.ships;s.x=1500;s.y=0;boss.x=boss.y=0;
 const choose=(seed:number)=>attackNavigation(s,boss,0,undefined,false,randomGenerator(seed))!.state;
 expect(choose(42)).toEqual(choose(42));expect(choose(42)).not.toEqual(choose(77));
 const random=randomGenerator(42),first=attackNavigation(s,boss,0,undefined,false,random)!.state,exit=attackNavigation(s,boss,1,first,true,random)!.state;
 const returnPlan=attackNavigation(s,boss,100,exit,false,random)!.state;expect(returnPlan.entry).not.toBe(first.entry);
});


test('capital evasions keep a lateral component and curve back into range instead of fleeing backwards indefinitely',async()=>{
 const{attackNavigation}=await import('../src/sim/maneuver'),{randomGenerator}=await import('../src/sim/math');const e=new BattleEngine();e.reset([{specId:'gladius',count:1},{specId:'bengal',count:1}],specs,17);const[s,boss]=e.ships;boss.x=boss.y=boss.vx=boss.vy=0;s.x=650;s.y=0;s.lastHit=-100;s.vx=0;s.vy=100;
 const random=randomGenerator(17),plan=attackNavigation(s,boss,1,undefined,false,random)!.state,evade=attackNavigation(s,boss,2,plan,true,random)!;
 expect(Math.abs(evade.velocity!.y)).toBeGreaterThan(s.spec.speed*.25);
 s.x=2200;const far=attackNavigation(s,boss,3,evade.state,true,random)!;expect(far.velocity!.x).toBeLessThan(0);expect(Math.abs(far.velocity!.y)).toBeGreaterThan(s.spec.speed*.25);
 s.x=650;const safe=attackNavigation(s,boss,5,far.state,false,random)!;expect(safe.state.phase).toBe('strike');
 const early=attackNavigation(s,boss,6,safe.state)!,later=attackNavigation(s,boss,12,safe.state)!;expect(early.velocity!.y).not.toBeCloseTo(later.velocity!.y);expect(later.state.phase).toBe('strike');
 const styles=new Set(Array.from({length:20},(_,seed)=>attackNavigation(s,boss,7,plan,true,randomGenerator(seed*1009+31))!.state.escape));expect(styles.size).toBe(3);
});

test('avoidance uses the narrow side of a long hull rather than its bounding circle',async()=>{
 const{hullRadiusAt}=await import('../src/sim/collisions');const e=new BattleEngine();e.reset([{specId:'retribution',count:1}],specs,42);const ship=e.ships[0];ship.heading=0;expect(hullRadiusAt(ship,Math.PI/2)).toBeLessThan(ship.radius*.4);expect(hullRadiusAt(ship,0)).toBeGreaterThan(ship.radius*.8);
});
test('re-entry cannot resample a longer reaction window and evade the same old hit again',async()=>{
 const{attackNavigation}=await import('../src/sim/maneuver'),{simulationSeconds}=await import('../src/sim/pacing');
 const e=new BattleEngine();e.reset([{specId:'terrapin',count:1},{specId:'idris-p',count:1}],specs,42);const[s,boss]=e.ships;
 Object.assign(s,{x:1000,y:0,lastHit:0});Object.assign(boss,{x:0,y:0,heading:0});
 const prior={target:boss.id,phase:'extend' as const,caution:.45,side:1};
 const rejoin=attackNavigation(s,boss,simulationSeconds(.6),prior,false,()=>1);
 expect(rejoin.state.phase).toBe('strike');expect(rejoin.state.caution).toBe(.45);
 const next=attackNavigation(s,boss,simulationSeconds(.62),rejoin.state,false,()=>1);
 expect(next.state.phase).toBe('strike');
 s.lastHit=simulationSeconds(.63);expect(attackNavigation(s,boss,s.lastHit,next.state,false,()=>1).state.phase).toBe('extend');
});

test('large ships approach range and sidestep fire without reversing from an already reachable small target',async()=>{
 const{attackNavigation}=await import('../src/sim/maneuver'),{randomGenerator}=await import('../src/sim/math');
 for(const id of ['hammerhead','reclaimer','idris-m','kraken-privateer','javelin','bengal']){
  const e=new BattleEngine();e.reset([{specId:id,count:1},{specId:'asgard',count:1}],data as ShipSpec[],42);const[s,t]=e.ships;
  s.x=s.y=t.y=s.vx=s.vy=t.vx=t.vy=0;s.heading=0;t.heading=Math.PI;s.lastHit=-100;t.x=(s.spec.length+t.spec.length)*.48+191;
  const quiet=attackNavigation(s,t,10,undefined,false,randomGenerator(42)),hit=attackNavigation(s,t,10,undefined,true,randomGenerator(42));
  expect(hit.state.phase).not.toBe('extend');expect(hit.velocity!.x).toBeGreaterThanOrEqual(-1e-6);expect(Math.abs(hit.velocity!.y)).toBeGreaterThan(s.spec.speed*.2);
  t.x=3000;const far=attackNavigation(s,t,10,undefined,false,randomGenerator(42));expect(far.velocity!.x).toBeGreaterThan(s.spec.speed*.5);
  t.x=800;t.vx=1000;const moving=attackNavigation(s,t,10,undefined,false,randomGenerator(42));t.vx=0;const idle=attackNavigation(s,t,10,undefined,false,randomGenerator(42));expect(moving.velocity!.x).toBeCloseTo(idle.velocity!.x);
  expect(quiet.boost).toBe(1);
 }
});
test('close large ships retain gun aim without a duplicate retreat or speed boost',async()=>{
 const{attackNavigation}=await import('../src/sim/maneuver'),{randomGenerator}=await import('../src/sim/math');
 const e=new BattleEngine();e.reset([{specId:'idris-m',count:1},{specId:'asgard',count:1}],data as ShipSpec[],42);const[s,t]=e.ships;
 s.x=s.y=t.y=s.vx=s.vy=t.vx=t.vy=0;s.heading=0;s.lastHit=-100;t.x=180;
 const plan=attackNavigation(s,t,10,undefined,false,randomGenerator(42));expect(plan.state.phase).toBe('strike');expect(plan.velocity!.x).toBeGreaterThanOrEqual(0);expect(Math.abs(plan.velocity!.y)).toBeGreaterThan(s.spec.speed*.05);expect(plan.coast).toBe(false);expect(plan.boost).toBe(1);expect(plan.heading).toBeCloseTo(0);
});

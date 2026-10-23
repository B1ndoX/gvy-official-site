import {expect,test} from 'vitest';
import data from '../src/data/ships.json';
import {evasion,evasionVelocity,handling} from '../src/sim/maneuver';
import {BattleEngine} from '../src/sim/engine';
import {battleRoster} from '../src/sim/members';
import type {ShipSpec} from '../src/sim/types';
const specs=(data as ShipSpec[]).map(s=>({...s,hull:s.hull*100,shield:s.shield*100,shieldRegen:0}));
test('engaged fighters keep moving laterally, change attack direction and still land shots',()=>{
 const e=new BattleEngine();e.reset([{specId:'gladius',count:2}],specs,21);e.ships.forEach((s,i)=>{s.x=i*700;s.y=0;s.heading=i?Math.PI:0;});e.start();
 let moving=0,forward=0,backward=0,samples=0;for(let i=0;i<45*60;i++){e.step();if(i>10*60){const a=e.ships[0],b=e.ships[1],dx=b.x-a.x,dy=b.y-a.y,cross=dx*a.vy-dy*a.vx;samples++;if(Math.hypot(a.vx,a.vy)>a.spec.speed*.08)moving++;if(cross>0)forward++;else backward++;}}
 expect(moving/samples).toBeGreaterThan(.8);expect(forward).toBeGreaterThan(60);expect(backward).toBeGreaterThan(60);expect(e.hits).toBeGreaterThan(0);
});
test('boss keeps advancing after its initial entrance without immobilising the member fleet',()=>{
 const e=new BattleEngine();e.reset(battleRoster([{specId:'gladius',count:10}],'challenge',21),specs,21,'challenge');e.start();const boss=e.snapshot().boss!;const start={x:boss.x,y:boss.y};let moving=0;
 for(let i=0;i<25*60;i++){e.step();if(i>5*60&&Math.hypot(boss.vx,boss.vy)>boss.spec.speed*.08)moving++;}
 expect(Math.hypot(boss.x-start.x,boss.y-start.y)).toBeGreaterThan(boss.spec.speed*3);expect(moving).toBeGreaterThan(10*60);expect(e.hits).toBeGreaterThan(0);
});

test('incoming hostile fire triggers a limited sideways burst; friendly fire and harmless misses do not',()=>{
 const e=new BattleEngine();e.reset([{specId:'arrow',count:2}],specs,21);const [s,other]=e.ships;s.x=0;s.y=0;s.vx=0;s.vy=0;s.heading=0;const ships=new Map(e.ships.map(s=>[s.id,s]));
 const idle={until:0,readyAt:0,scanAt:0,side:1},p={id:99,owner:other.id,target:s.id,kind:'laser' as const,x:500,y:0,vx:-1000,vy:0,angle:Math.PI,speed:1000,damage:10,ttl:1,travel:0,range:1000,color:0xffffff};
 const active=evasion(s,ships,[p],1,idle),move=evasionVelocity(s,0,active,1);expect(active.until).toBeGreaterThan(1);expect(Math.abs(move.y)).toBeGreaterThan(s.spec.speed*.6);expect(move.boost).toBeGreaterThan(1.4);expect(evasionVelocity(s,0,active,active.until+.1).boost).toBe(1);
 expect(evasion(s,ships,[p],active.until+.1,active)).toEqual(active);expect(evasion(s,ships,[{...p,y:500}],1,idle).until).toBe(0);s.team=other.team='members';expect(evasion(s,ships,[p],1,idle).until).toBe(0);
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

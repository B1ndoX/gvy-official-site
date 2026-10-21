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

test('torpedo bombers counter an unescorted capital but interceptors and point defense counter bombers',()=>{
 const original=data as ShipSpec[];
 for(const [a,b,expected] of [['eclipse','javelin','eclipse'],['gladius','eclipse','gladius'],['hammerhead','eclipse','hammerhead']] as const){
  let wins=0;for(const seed of [1,2,3,4]){const e=new BattleEngine();e.reset([{specId:a,count:1},{specId:b,count:1}],original,seed);e.asteroids=[];e.ships.forEach((s,i)=>{s.x=i?650:-650;s.y=0;s.heading=i?Math.PI:0;});e.start();for(let i=0;i<600*60&&e.phase==='running';i++)e.step();expect(e.phase).toBe('finished');wins+=Number(e.living[0]?.spec.id===expected);}
  expect(wins).toBeGreaterThanOrEqual(3);
 }
},30000);

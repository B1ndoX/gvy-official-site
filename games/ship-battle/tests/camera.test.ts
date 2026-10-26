import {expect,test} from 'vitest';
import data from '../src/data/ships.json';
import {BattleEngine} from '../src/sim/engine';
import type {ShipSpec,Projectile} from '../src/sim/types';
import {CombatDirector,engagementFrame,shipFocusSpan,trackedCenter} from '../src/render/CombatDirector';
const specs=data as ShipSpec[];
function setup(){const e=new BattleEngine();e.reset([{specId:'gladius',count:3}],specs,21);return e;}
const shot=(owner:number,target:number):Projectile=>({id:owner,owner,target,kind:'laser',x:0,y:0,vx:1,vy:0,angle:0,speed:1,damage:1,ttl:1,travel:0,range:1000,color:0xffffff});
test('zero-kill fighters earn camera time through real fire and incoming damage, never friendly targets',()=>{
  const e=setup(),d=new CombatDirector();e.ships[0].team='members';e.ships[1].team='members';e.ships[2].npc='boss';e.ships[2].team='enemy';
  const scene=d.update(e.ships,[shot(1,2),shot(3,2)],[],1,1/60)!;
  expect(scene.subject.id).toBe(2);expect(scene.target?.id).toBe(3);expect(scene.subject.kills).toBe(0);expect(scene.active).toBe(true);
});
test('camera holds live combat, rotates members after a full shot and freezes rotation during pause',()=>{
  const e=setup(),d=new CombatDirector(),shots=[shot(1,3),shot(2,3)];
  const initial=d.update(e.ships,shots,[],1,0)!.subject.id;
  for(let i=0;i<240;i++)expect(d.update(e.ships,shots,[],1,i<210?1/60:0)!.subject.id).toBe(initial);
  let next=initial;for(let i=0;i<400&&next===initial;i++)next=d.update(e.ships,shots,[],1,1/60)!.subject.id;
  expect(next).not.toBe(initial);
});
test('death keeps the explosion briefly then changes to a living engagement',()=>{
  const e=setup(),d=new CombatDirector(),shots=[shot(1,2),shot(3,2)];
  const first=d.update(e.ships,shots,[],1,0)!;first.subject.alive=false;
  expect(d.update(e.ships,shots,[],1,.5)?.subject.id).toBe(first.subject.id);
  expect(d.update(e.ships,shots,[],1,.7)?.subject.alive).toBe(true);
});
test('giant boss framing keeps the member and facing hull section readable without fitting the entire boss',()=>{
  const e=setup(),fighter=e.ships[0],boss=e.ships[1];
  fighter.x=1600;fighter.y=0;boss.spec=specs.find(s=>s.id==='retribution')!;boss.radius=boss.spec.length/2;boss.heading=0;boss.x=0;boss.y=0;
  const frame=engagementFrame(fighter,boss,1200,700);
  expect(frame.x).toBeGreaterThan(1000);expect(frame.span).toBeLessThan(1200);expect(Number.isFinite(frame.span)).toBe(true);
  const portrait=engagementFrame(fighter,boss,360,600);expect(portrait.span).toBeGreaterThan(0);expect(Number.isFinite(portrait.span)).toBe(true);
});

test('small fighter and capital ship occupy the same focus pixels without changing world dimensions',()=>{
 const e=setup(),ship=e.ships[0];
 for(const [w,h,ui] of [[1200,700,1],[3840,2160,2],[360,600,1]]){
  const pixels=[];
  for(const id of ['mpuv-cargo','gladius','javelin','retribution']){const spec=specs.find(s=>s.id===id);if(!spec)continue;ship.spec=spec;const span=shipFocusSpan(ship,w,h,ui);pixels.push(spec.length*Math.min(w,h)/span);const scene=engagementFrame(ship,e.ships[1],w,h,ui);expect(scene.span).toBeLessThanOrEqual(span*100/48*1.5+.001);}
  expect(Math.max(...pixels)-Math.min(...pixels)).toBeLessThan(.01);
 }
});

test('camera carries fast subject motion exactly at any zoom while easing only composition',()=>{
 let subject={id:1,x:0,y:0},previous={...subject},center={x:20,y:-10};
 for(let i=0;i<300;i++){subject={id:1,x:subject.x+8,y:subject.y-5};center=trackedCenter(center,previous,subject,{x:subject.x+20,y:subject.y-10},.06);previous={...subject};expect(center.x-subject.x).toBeCloseTo(20);expect(center.y-subject.y).toBeCloseTo(-10);}
 const next=trackedCenter(center,previous,{id:2,x:-1000,y:300},{x:-1000,y:300},.1);expect(next.x).toBeCloseTo(center.x+(-1000-center.x)*.1);
});

test('switching from an overview or giant hull constrains automatic framing to keep the next member readable',async()=>{
 const {spectatorSpan}=await import('../src/render/CombatDirector');
 expect(spectatorSpan(100000,300,true)).toBeLessThanOrEqual(510);
 expect(spectatorSpan(20,300,true)).toBeGreaterThanOrEqual(180);
 expect(spectatorSpan(300,300,false)).toBe(300);
 const e=setup(),d=new CombatDirector(),scene=d.update(e.ships,[],[],0,1/60)!;
 expect(scene.subject.alive).toBe(true);expect(scene.active).toBe(false);expect(engagementFrame(scene.subject,scene.target,1200,700).span).toBeLessThan(1200);
});

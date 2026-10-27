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
  const e=setup(),d=new CombatDirector(()=>.25),shots=[shot(1,3),shot(2,3)];
  e.ships.forEach((s,i)=>Object.assign(s,{x:i===2?800:i*100,y:0}));
  const initial=d.update(e.ships,shots,[],1,0)!.subject.id;
  for(let i=0;i<240;i++)expect(d.update(e.ships,shots,[],1,i<210?1/60:0)!.subject.id).toBe(initial);
  let next=initial;for(let i=0;i<400&&next===initial;i++)next=d.update(e.ships,shots,[],1,1/60)!.subject.id;
  expect(next).not.toBe(initial);
});
test('an immediate death preserves the scene instead of starting a rapid chain of cuts',()=>{
  const e=setup(),d=new CombatDirector(),shots=[shot(1,2),shot(3,2)];
  const first=d.update(e.ships,shots,[],1,0)!;first.subject.alive=false;
  expect(d.update(e.ships,shots,[],1,.5)?.subject.id).toBe(first.subject.id);
  expect(d.update(e.ships,shots,[],1,1.5)?.subject.id).toBe(first.subject.id);
  expect(d.update(e.ships,shots,[],1,4.1)?.subject.alive).toBe(true);
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
  for(const id of ['mpuv-cargo','gladius','javelin','retribution']){const spec=specs.find(s=>s.id===id);if(!spec)continue;ship.spec=spec;const span=shipFocusSpan(ship,w,h,ui);pixels.push(spec.length*Math.min(w,h)/span);}
  expect(Math.max(...pixels)-Math.min(...pixels)).toBeLessThan(.01);
 }
});
test.each([
 ['gladius','gladius',1200,700,1,-1500,0,0,1.2],
 ['polaris','gladius',1200,700,1,-1000,0,.8,-.4],
 ['terrapin','constellation-andromeda',900,600,1,-700,350,1.1,-.4],
 ['gladius','gladius',360,600,1,0,-1500,0,1.5],
 ['gladius','gladius',3840,2160,2,2400,-900,.4,-.7],
 ] as const)('pair framing keeps both complete %s/%s hulls visible at range in a %s×%s usable viewport',(a,b,width,height,ui,x,y,heading,targetHeading)=>{
 const e=setup(),subject=e.ships[0],target=e.ships[1];
 subject.spec=specs.find(s=>s.id===a)!;target.spec=specs.find(s=>s.id===b)!;
 Object.assign(subject,{x:0,y:0,heading});Object.assign(target,{x,y,heading:targetHeading});
 const frame=engagementFrame(subject,target,width,height,ui),k=Math.min(width,height)/frame.span;
 for(const ship of [subject,target])for(const forward of [-.5,.5])for(const lateral of [-.5,.5]){
  const wx=ship.x+forward*ship.spec.length*Math.cos(ship.heading)-lateral*ship.spec.beam*Math.sin(ship.heading);
  const wy=ship.y+forward*ship.spec.length*Math.sin(ship.heading)+lateral*ship.spec.beam*Math.cos(ship.heading);
  const sx=width/2+(wx-frame.x)*k,sy=height/2+(wy-frame.y)*k;
  expect(sx).toBeGreaterThan(15*ui);expect(sx).toBeLessThan(width-15*ui);
  expect(sy).toBeGreaterThan(20*ui);expect(sy).toBeLessThan(height-20*ui);
 }
});
test('pair camera expands for separation beyond the old subject-only cap and closes again on approach',()=>{
 const e=setup(),[subject,target]=e.ships;Object.assign(subject,{x:0,y:0,heading:0});Object.assign(target,{x:80,y:0,heading:0});
 const close=engagementFrame(subject,target,1200,700);target.x=-1500;
 const far=engagementFrame(subject,target,1200,700);expect(far.span).toBeGreaterThan(close.span*3);expect(far.x).toBeLessThan(-500);
 target.x=80;expect(engagementFrame(subject,target,1200,700)).toEqual(close);
});

test('camera carries fast subject motion exactly at any zoom while easing only composition',()=>{
 let subject={id:1,x:0,y:0},previous={...subject},center={x:20,y:-10};
 for(let i=0;i<300;i++){subject={id:1,x:subject.x+8,y:subject.y-5};center=trackedCenter(center,previous,subject,{x:subject.x+20,y:subject.y-10},.06);previous={...subject};expect(center.x-subject.x).toBeCloseTo(20);expect(center.y-subject.y).toBeCloseTo(-10);}
 const next=trackedCenter(center,previous,{id:2,x:-1000,y:300},{x:-1000,y:300},.1);expect(next.x).toBeCloseTo(center.x+(-1000-center.x)*.1);
});

test('automatic zoom approaches fighters and opens out for capitals smoothly on real time',async()=>{
 const {spectatorSpan}=await import('../src/render/CombatDirector');
 expect(spectatorSpan(100000,300,1/60)).toBeGreaterThan(98000);
 expect(spectatorSpan(20,300,1/60)).toBeLessThan(20.7);
 expect(spectatorSpan(300,300,1/60)).toBeCloseTo(300);
 expect(spectatorSpan(300,20000,0)).toBeCloseTo(300);
 let at60=100000,at30=100000;
 for(let i=0;i<600;i++)at60=spectatorSpan(at60,300,1/60);
 for(let i=0;i<300;i++)at30=spectatorSpan(at30,300,1/30);
 expect(at60).toBeLessThan(330);expect(at60).toBeCloseTo(at30,7);
 expect(spectatorSpan(1000,960,1)).toBe(1000);
 let oscillating=1000;for(let i=0;i<120;i++)oscillating=spectatorSpan(oscillating,i%2?970:1000,1/60);
 expect(oscillating).toBeCloseTo(1000,7);
 const e=setup(),d=new CombatDirector(),scene=d.update(e.ships,[],[],0,1/60)!;
 expect(scene.subject.alive).toBe(true);expect(scene.active).toBe(false);expect(engagementFrame(scene.subject,scene.target,1200,700).span).toBeLessThan(1200);
});
test('boss fights use varied real-time shot lengths and freeze selection during pause',()=>{
 const e=setup();e.ships[2].npc='boss';e.ships[2].team='enemy';
 Object.assign(e.ships[0],{x:600,y:0});Object.assign(e.ships[1],{x:650,y:0});Object.assign(e.ships[2],{x:0,y:0});
 let draw=0;const d=new CombatDirector(()=>draw++%2),shots=[shot(1,3),shot(2,3)],changes:number[]=[];
 let previous=0;
 for(let i=0;i<320;i++){
  const scene=d.update(e.ships,shots,[],1,.1)!;expect(scene.target?.id).toBe(3);
  if(scene.subject.id!==previous){changes.push(i*.1);previous=scene.subject.id;}
 }
 const holds=changes.slice(1).map((t,i)=>t-changes[i]);expect(holds.length).toBeGreaterThanOrEqual(2);
 expect(Math.max(...holds)-Math.min(...holds)).toBeGreaterThan(2);
 expect(holds.every(t=>t>=6.9&&t<=10.2)).toBe(true);
 const paused=d.update(e.ships,shots,[],1,0)!;expect(paused.subject.id).toBe(previous);
});
test('hull health neither excludes nor favours a spectator subject, and low hull does not force a cut',()=>{
 const e=setup(),d=new CombatDirector(()=>0),[a,b,boss]=e.ships;boss.npc='boss';boss.team='enemy';
 Object.assign(a,{x:600,y:0,hull:a.spec.hull*.1});Object.assign(b,{x:650,y:0});Object.assign(boss,{x:0,y:0});
 const shots=[...Array.from({length:20},()=>shot(a.id,boss.id)),shot(b.id,boss.id)];
 expect(d.update(e.ships,shots,[],1,0)?.subject.id).toBe(a.id);
 a.hull=a.spec.hull*.01;expect(d.update(e.ships,shots,[],1,2)?.subject.id).toBe(a.id);
 const other=new CombatDirector(()=>0);a.hull=a.spec.hull;b.hull=b.spec.hull*.01;
 expect(other.update(e.ships,shots,[],1,0)?.subject.id).toBe(a.id);
});
test('death holds the scene, then can randomly select a far combatant without a nearby preference',()=>{
 const e=new BattleEngine();e.reset([{specId:'gladius',count:4}],specs,21);const[a,near,far,boss]=e.ships,d=new CombatDirector(()=>.99);
 e.ships.forEach((s,i)=>Object.assign(s,{x:[0,100,5000,800][i],y:0}));boss.npc='boss';boss.team='enemy';
 const shots=[...Array.from({length:8},()=>shot(a.id,boss.id)),shot(near.id,boss.id),...Array.from({length:12},()=>shot(far.id,boss.id))];
 expect(d.update(e.ships,[shot(a.id,boss.id)],[],1,0)?.subject.id).toBe(a.id);a.alive=false;
 expect(d.update(e.ships,shots,[],1,1.2)?.subject.id).toBe(a.id);
 expect(d.update(e.ships,shots,[],1,3)?.subject.id).toBe(a.id);
 expect(d.update(e.ships,shots,[],1,2)?.subject.id).toBe(far.id);
 far.alive=false;expect(d.update(e.ships,shots,[],1,1.2)?.subject.id).toBe(far.id);
 expect(d.update(e.ships,shots,[],1,3)?.subject.id).toBe(far.id);
 expect(d.update(e.ships,shots,[],1,2)?.subject.id).toBe(near.id);
});
test('a firing gap holds the scene, then random selection includes distant ships regardless of activity or health',()=>{
 const e=setup(),d=new CombatDirector(()=>0),[a,far,boss]=e.ships;boss.npc='boss';boss.team='enemy';
 Object.assign(a,{x:600,y:0});Object.assign(far,{x:10000,y:0});Object.assign(boss,{x:0,y:0});
 const shots=[...Array.from({length:8},()=>shot(a.id,boss.id)),shot(far.id,boss.id)];
 const initial=d.update(e.ships,shots,[],1,0)!.subject.id;
 expect(d.update(e.ships,[],[],1,2)?.subject.id).toBe(initial);
 expect(d.update(e.ships,shots,[],1,6)?.subject.id).toBe(far.id);
 a.hull=a.spec.hull*.05;far.hull=far.spec.hull*.05;
 expect(d.update(e.ships,shots,[],1,7.1)?.subject.id).toBe(initial);
});
test('global random selection weights members equally across regions, multiple targets and gun counts',()=>{
 const e=new BattleEngine();e.reset([{specId:'gladius',count:5}],specs,21);const[a,b,c,boss,escort]=e.ships;
 e.ships.forEach((s,i)=>Object.assign(s,{x:i*10000,y:0}));boss.npc='boss';escort.npc='escort';
 c.hull=c.spec.hull*.01;
 const shots=[...Array.from({length:30},()=>shot(a.id,boss.id)),shot(a.id,escort.id),shot(b.id,escort.id),shot(c.id,boss.id)];
 const selected=new Map<number,number>();
 for(let i=0;i<300;i++){const d=new CombatDirector(()=>(i+.5)/300),id=d.update(e.ships,shots,[],1,0)!.subject.id;selected.set(id,(selected.get(id)??0)+1);}
 expect([...selected.keys()]).toEqual([a.id,b.id,c.id]);expect([...selected.values()]).toEqual([100,100,100]);
});
test('travel does not consume a new shot, and a dead destination has a finite linger during travel',()=>{
 const e=setup(),d=new CombatDirector(()=>0),shots=[shot(1,3),shot(2,3)];e.ships[2].npc='boss';
 const first=d.update(e.ships,shots,[],1,0)!;
 for(let i=0;i<100;i++)expect(d.update(e.ships,shots,[],1,.1,true)?.subject.id).toBe(first.subject.id);
 expect(d.update(e.ships,shots,[],1,2)?.subject.id).toBe(first.subject.id);
 first.subject.alive=false;
 expect(d.update(e.ships,shots,[],1,1,true)?.subject.id).toBe(first.subject.id);
 expect(d.update(e.ships,shots,[],1,1.6,true)?.subject.alive).toBe(true);
});

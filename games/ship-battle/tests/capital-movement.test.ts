import {expect,test} from 'vitest';
import data from '../src/data/ships.json';
import {BattleEngine} from '../src/sim/engine';
import {attackNavigation} from '../src/sim/maneuver';
import {randomGenerator} from '../src/sim/math';
import type {Ship,ShipSpec,BattleMode} from '../src/sim/types';
import {localizedShips} from '../src/data/localized-ships';
import {prepareCombatSpecs} from '../src/sim/combat-tuning';
import stuck from './fixtures/capital-rock-chatter.json';
import muzzleStuck from './fixtures/muzzle-route-chatter.json';
const specs=data as ShipSpec[];
function setup(seed=31){
 const a={...structuredClone(specs.find(s=>s.id==='idris-p')!) as ShipSpec,mounts:[],shieldRegen:0};
 const b={...structuredClone(specs.find(s=>s.id==='mauler')!) as ShipSpec,mounts:[],speed:0,acceleration:0,turnRate:0,shieldRegen:0};
 const e=new BattleEngine();e.reset([{specId:a.id,count:1},{specId:b.id,count:1}],[a,b],seed);e.asteroids=[];
 e.ships.forEach((s,i)=>{s.x=i*350;s.y=0;s.heading=i?Math.PI:0;s.vx=i?0:a.speed;s.vy=0;});e.start();return e;
}
function restore(fixture:typeof stuck|typeof muzzleStuck){
 const current=prepareCombatSpecs(localizedShips),byId=new Map(current.map(s=>[s.id,s])),e=new BattleEngine();
 e.reset([{specId:'idris-m',count:1},{specId:'idris-p',count:1}],current,fixture.seed,fixture.mode as BattleMode);
 const entries=(rows:unknown)=>new Map(rows as [number,unknown][]);
 Object.assign(e,{phase:'running',time:fixture.time,arena:fixture.arena,sequence:fixture.sequence,
  ships:fixture.ships.map(({specId,...s})=>({...structuredClone(s),spec:byId.get(specId)!}) as Ship),
  asteroids:structuredClone(fixture.rocks),projectiles:structuredClone(fixture.projectiles),beams:structuredClone(fixture.beams),
  attackRuns:entries(fixture.attackRuns),terrainLanes:entries(fixture.terrainLanes),evasions:entries(fixture.evasions),beamTurns:entries(fixture.beamTurns)});
 return e;
}
test('a large hull initially driving nose-first into its boss moves laterally clear instead of remaining pinned',()=>{
 const e=setup(),s=e.ships[0],initial={x:s.x,y:s.y},health=s.hull+s.shield;
 // Start outside stopping distance. An already-overlapping full-speed ram is
 // intentionally dangerous under the current collision rules.
 e.ships[1].x=700;
 let lateral=0,travel=0;
 for(let i=0;i<30*60;i++){const x=s.x,y=s.y;e.step();lateral=Math.max(lateral,Math.abs(s.y-initial.y));travel+=Math.hypot(s.x-x,s.y-y);}
 // A random course may return across its initial lane. Measure the actual
 // excursion/path, rather than requiring it to finish on one prescribed side.
 expect(lateral).toBeGreaterThan(s.spec.length*.2);expect(travel).toBeGreaterThan(s.spec.length*.5);expect(s.alive).toBe(true);expect(s.hull+s.shield).toBeGreaterThan(health*.9);
});
test('close capitals use seeded firing lanes instead of a second retreat plan',()=>{
 const e=setup(),[s,target]=e.ships,lanes=new Set<number>();
 for(let seed=1;seed<=16;seed++){
  const random=randomGenerator(seed*991),first=attackNavigation(s,target,0,undefined,false,random)!;lanes.add(Math.sign(first.velocity!.y));
  expect(first.state.phase).toBe('strike');expect(first.coast).toBe(false);expect(Math.abs(first.velocity!.y)).toBeGreaterThan(s.spec.speed*.05);
  const next=attackNavigation(s,target,10,first.state,false,random)!;expect(next.state.phase).toBe('strike');expect(next.coast).toBe(false);
 }
 expect(lanes.size).toBe(2);
});
test('a heavy forward gun retains a lead solution while moving sideways and a quiet distant hull can approach',()=>{
 const e=setup(),[s,target]=e.ships;s.spec.mounts=[structuredClone(specs.find(s=>s.id==='idris-m')!.mounts[0])];target.vy=60;s.x=-900;
 const close=attackNavigation(s,target,0,undefined)!;expect(close.heading).toBeGreaterThan(0);expect(Math.abs(close.velocity!.y)).toBeGreaterThan(0);
 s.x=-1600;s.y=0;s.vx=s.vy=0;target.vx=target.vy=0;const far=attackNavigation(s,target,100,undefined)!;expect(far.state.phase).toBe('approach');expect(far.velocity!.x).toBeGreaterThan(0);
});

test('a capital firing lane varies on both sides of the same target without per-frame random jitter',()=>{
 const e=setup(),[s,target]=e.ships;s.x=s.y=target.y=0;target.x=700;s.lastHit=-100;
 const randomSource=randomGenerator(24027);let calls=0;const random=()=>{calls++;return randomSource();};
 let prior:ReturnType<typeof attackNavigation>['state']|undefined,previous=0,maxChange=0;const signs=new Set<number>(),decisions:number[]=[];
 for(let frame=0;frame<90*60;frame++){
  const before=calls,plan=attackNavigation(s,target,frame/60,prior,true,random);prior=plan.state;
  expect(plan.state.phase).toBe('strike');expect(plan.velocity!.x).toBeGreaterThanOrEqual(-.000001);
  const tangent=plan.velocity!.y/s.spec.speed;
  if(Math.abs(tangent)>.08)signs.add(Math.sign(tangent));
  if(frame)maxChange=Math.max(maxChange,Math.abs(tangent-previous));previous=tangent;
  if(calls>before)decisions.push(frame/60);
 }
 expect(signs.size).toBe(2);expect(decisions.length).toBeGreaterThan(5);expect(decisions.length).toBeLessThan(30);
 expect(maxChange).toBeLessThan(.02);
 const intervals=decisions.slice(1).map((t,i)=>Math.round((t-decisions[i])*60));expect(new Set(intervals).size).toBeGreaterThan(3);
});

test('capital lane choices are repeatable by seed and do not reset on every hit',()=>{
 const sample=(seed:number)=>{
  const e=setup(),[s,target]=e.ships;s.x=s.y=target.y=0;target.x=700;s.lastHit=-100;
  const random=randomGenerator(seed),rows:number[]=[];let prior:ReturnType<typeof attackNavigation>['state']|undefined;
  for(let frame=0;frame<60*60;frame++){
   const time=frame/60;s.lastHit=time;
   const plan=attackNavigation(s,target,time,prior,true,random);prior=plan.state;
   if(frame%60===0)rows.push(plan.velocity!.y);
  }
  return rows;
 };
 expect(sample(24)).toEqual(sample(24));expect(sample(24)).not.toEqual(sample(25));
 expect(sample(24).some(v=>v>0)).toBe(true);expect(sample(24).some(v=>v<0)).toBe(true);
});

test('real stopped Idris pair leaves its tiny-rock position without opposite retreat commands',()=>{
 const e=restore(stuck);
 const positions=e.ships.map(s=>({x:s.x,y:s.y})),travel=e.ships.map(()=>0),maxDistance=e.ships.map(()=>0);
 for(let step=0;step<40*60;step++){
  const before=e.ships.map(s=>({x:s.x,y:s.y}));e.step();
  e.ships.forEach((s,i)=>{travel[i]+=Math.hypot(s.x-before[i].x,s.y-before[i].y);maxDistance[i]=Math.max(maxDistance[i],Math.hypot(s.x-positions[i].x,s.y-positions[i].y));});
 }
 expect(e.ships.every(s=>s.alive)).toBe(true);expect(e.hits).toBeGreaterThan(0);
 for(let i=0;i<e.ships.length;i++){expect(travel[i]).toBeGreaterThan(60);expect(maxDistance[i]).toBeGreaterThan(40);}
});

test('a real muzzle-edge stall resumes movement when navigation uses the hull origin',()=>{
 const e=restore(muzzleStuck),s=e.ships.find(s=>s.id===31)!;let still=0,maxStill=0,travel=0;
 for(let i=0;i<24*60&&e.phase==='running';i++){
  const x=s.x,y=s.y;e.step();travel+=Math.hypot(s.x-x,s.y-y);
  still=Math.hypot(s.vx,s.vy)<s.spec.speed*.02?still+.75/60:0;maxStill=Math.max(maxStill,still);
 }
 expect(s.alive).toBe(true);expect(travel).toBeGreaterThan(60);expect(maxStill).toBeLessThan(2);
});

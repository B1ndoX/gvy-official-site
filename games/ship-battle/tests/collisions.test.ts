import{expect,test}from'vitest';
import data from'../src/data/ships.json';
import{BattleEngine,STEP}from'../src/sim/engine';
import{shipContact,shipImpact,SHIP_IMPACT_LIMIT,SHIP_IMPACT_PER_SECOND}from'../src/sim/collisions';
import type{ShipSpec}from'../src/sim/types';
function setup(a='arrow',b='arrow',count=3){
 const specs=[a,b,'gladius'].map((id,i)=>({...structuredClone(data.find(s=>s.id===id)!),id:`ship-${i}`,mounts:[],acceleration:0,turnRate:0,shieldRegen:0})) as ShipSpec[];
 const e=new BattleEngine();e.reset(Array.from({length:count},(_,i)=>({specId:specs[Math.min(i,2)].id,count:1})),specs,42);e.asteroids=[];
 e.ships.forEach((s,i)=>{s.x=i*4000;s.y=0;s.heading=0;s.vx=0;s.vy=0});e.start();return e;
}
function contact(e:BattleEngine,speed:number,b=1){const [a]=e.ships,other=e.ships[b];a.x=0;a.y=0;other.x=(a.spec.length+other.spec.length)*.48+6-2;other.y=0;a.vx=speed/2;other.vx=-speed/2;a.vy=other.vy=0;}
test('low-speed touches and separating motion do not damage hulls',()=>{for(const speed of [0,30,80,-200]){const e=setup();contact(e,speed);const before=e.ships.map(s=>s.hull);e.step();expect(e.ships.map(s=>s.hull)).toEqual(before);}});
test('same collision settings apply to friend and foe, with square-law speed growth and hull-size asymmetry',()=>{
 const e=setup('arrow','javelin'),[small,big]=e.ships;const slow=shipImpact(small,big,150),fast=shipImpact(small,big,220);expect(fast.a).toBeGreaterThan(slow.a);expect(slow.a/small.spec.hull).toBeGreaterThan((slow.b/big.spec.hull)*100);
 small.team=big.team='members';expect(shipImpact(small,big,220)).toEqual(fast);
 const same=setup().ships;expect(shipImpact(same[0],same[1],same[0].spec.speed+same[1].spec.speed).fatalA).toBe(true);
});
test('fast normal small-to-large impact is fatal; slow and tangential contacts are protected',()=>{
 const e=setup('arrow','javelin'),[small,big]=e.ships;small.vx=450;expect(shipImpact(small,big,450).fatalA).toBe(true);expect(shipImpact(small,big,450).fatalB).toBe(false);
 small.vx=30;expect(shipImpact(small,big,30).fatalA).toBe(false);small.vx=0;small.vy=450;expect(shipImpact(small,big,0).fatalA).toBe(false);
});
test('oriented hull checks allow ships beside a long hull without a false bounding-circle collision',()=>{const e=setup('arrow','javelin'),[a,b]=e.ships;b.x=0;b.y=0;a.x=0;a.y=b.spec.beam*.5+60;expect(Math.hypot(a.x-b.x,a.y-b.y)).toBeLessThan(a.radius+b.radius);expect(shipContact(a,b)).toBeNull();a.y=0;a.x=b.spec.length*.48+a.spec.length*.48+4;expect(shipContact(a,b)).not.toBeNull();});
test('one continuous contact only damages once, while pause freezes collision settlement',()=>{const e=setup();contact(e,240);e.step();const hull=e.ships[0].hull;expect(hull).toBeLessThan(e.ships[0].spec.hull);for(let i=0;i<20;i++){contact(e,240);e.step();}expect(e.ships[0].hull).toBe(hull);e.pause();contact(e,500);e.step();expect(e.ships[0].hull).toBe(hull);});
test('multiple attackers in one second share the same per-victim impact limit',()=>{
 const e=setup('arrow','arrow',18),victim=e.ships[0];for(let i=1;i<18;i++){e.ships.forEach((s,j)=>{if(j!==0&&j!==i){s.x=j*4000;s.y=4000;s.vx=s.vy=0}});contact(e,150,i);e.step();}expect(victim.spec.hull-victim.hull).toBeLessThanOrEqual(victim.spec.hull*SHIP_IMPACT_PER_SECOND+1e-6);
});
test('collision kills use their own cause and credit the opposing ship; friendly deaths give no score',()=>{
 for(const friendly of [false,true]){const e=setup();contact(e,300);const [a,b]=e.ships;a.hull=1;if(friendly)a.team=b.team='members';e.step();expect(a.alive).toBe(false);expect(b.kills).toBe(friendly?0:1);expect(e.collisionDeaths).toBe(friendly?1:0);expect(e.killLog.at(-1)).toMatchObject({cause:'collision',victimId:a.id,killerId:b.id,...(friendly?{friendly:true}:{})});}
});
test('mutual collision deaths credit both ships and merge the notice before the surviving third wins',()=>{const e=setup();contact(e,300);const [a,b,c]=e.ships;a.hull=b.hull=1;e.step();expect(a.alive||b.alive).toBe(false);expect(a.kills).toBe(1);expect(b.kills).toBe(1);expect(e.killLog).toHaveLength(1);expect(e.killLog[0].mutual).toBe(true);expect(e.snapshot().winner?.id).toBe(c.id);expect(e.snapshot().destroyed).toBe(2);});
test('an extreme small-ship ram destroys it but barely hurts the large hull',()=>{const e=setup('arrow','javelin'),[a,b]=e.ships;contact(e,0);a.vx=450;const hull=b.hull;e.step();expect(a.alive).toBe(false);expect(b.alive).toBe(true);expect((hull-b.hull)/b.spec.hull).toBeLessThan(.01);expect(b.kills).toBe(1);});

test('slow massive hulls can still have lethal high-energy head-on collisions at their own full flight speeds',()=>{
 for(const id of ['asgard','idris-m','javelin','bengal']){
  const [a,b]=setup(id,id).ships,full=a.spec.speed+b.spec.speed;
  const slow=shipImpact(a,b,full*.2),middle=shipImpact(a,b,full*.7),fast=shipImpact(a,b,full);
  expect(slow.a).toBe(0);expect(middle.a).toBeGreaterThan(0);expect(middle.a).toBeLessThan(a.spec.hull);expect(fast.fatalA&&fast.fatalB).toBe(true);
 }
});
test('impact damage changes smoothly with normal closing speed and mass ratio, without a 35-metre fatal switch',()=>{
 const [a,b]=setup('arrow','javelin').ships;let previous=0;
 for(let closing=0;closing<=450;closing+=.5){const now=shipImpact(a,b,closing).a/a.spec.hull;expect(now).toBeGreaterThanOrEqual(previous);expect(now-previous).toBeLessThan(.1);previous=now;}
 const small={...a,spec:{...a.spec,length:34.999}},large={...a,spec:{...a.spec,length:35.001}};
 expect(shipImpact(small,b,220).a).toBeCloseTo(shipImpact(large,b,220).a,6);
});
test('high-energy damage is not swallowed by the ordinary per-second scrape cap',()=>{
 const e=setup('idris-m','idris-m');contact(e,e.ships[0].spec.speed*2);e.step();expect(e.ships[0].alive||e.ships[1].alive).toBe(false);
});

import {test,expect} from 'vitest';
import defenseRules from '../src/data/defense-balance.json';
import ships from '../src/data/ships.json';
import {BattleEngine} from '../src/sim/engine';
import {weaponDps,projectileDamage} from '../src/sim/weapons';
import {upgradeCombat,type ShipAsset} from '../src/assets/library';
import manifest from '../public/assets/ships/manifest.json';
import type {ShipSpec,WeaponKind} from '../src/sim/types';
function duel(id:string,kind:WeaponKind,target='hammerhead'){
 const a=structuredClone(ships.find(s=>s.id===id)!) as ShipSpec,b=structuredClone(ships.find(s=>s.id===target)!) as ShipSpec;
 a.mounts=a.mounts.filter(m=>m.kind===kind).map(m=>({...m,charge:0}));b.mounts=[];
 const e=new BattleEngine();e.reset([{specId:id,count:1},{specId:target,count:1}],[a,b].map(s=>({...s,speed:0,acceleration:0,turnRate:0,shieldRegen:0})),42);
 e.asteroids=[];e.ships.forEach((s,i)=>{s.x=i*1300;s.y=0;s.heading=i?Math.PI:0;s.cooldowns.fill(0);});e.start();return e;
}
const step=(e:BattleEngine,n:number)=>{for(let i=0;i<n;i++)e.step();};
test('finite nose beam uses actual collision, then cools down and resets cleanly',()=>{
 const e=duel('idris-p','beam'),m=e.ships[0].spec.mounts[0];step(e,40);
 expect(e.beams).toHaveLength(1);const segment=e.beams[0].segments[0];expect(segment.from.x).toBeCloseTo(e.ships[0].spec.length*.49);expect(segment.to.x).toBeLessThan(e.ships[1].x);expect(e.ships[1].shield).toBeLessThan(e.ships[1].spec.shield);
 step(e,Math.ceil(m.duration!*60)+5);expect(e.beams).toHaveLength(0);expect(e.shots).toBe(1);expect(e.ships[0].cooldowns[0]).toBeGreaterThan(m.cooldown-1);
 e.reset([],ships as ShipSpec[]);expect(e.beams).toHaveLength(0);
});
test('Odin draws one broad beam with one damage budget',()=>{
 const e=duel('odin','beam'),t=e.ships[1],m=e.ships[0].spec.mounts[0];t.spec={...t.spec,hull:1e8,shield:0,beam:1000};t.hull=1e8;t.shield=0;
 step(e,1);expect(e.beams[0].segments).toHaveLength(1);expect(m.beamWidth).toBe(45);step(e,Math.ceil(m.duration!*60)+2);
 expect(1e8-t.hull).toBeCloseTo(m.damage*m.duration!,3);expect(e.shots).toBe(1);
 expect(weaponDps(m)).toBeGreaterThan(15000);
});
test('asteroids block continuous beams and prevent damage behind them',()=>{
 const e=duel('tiburon','beam');e.asteroids=[{id:1,x:650,y:0,radius:130,rotation:0}];step(e,60);
 expect(e.beams[0].segments[0].hit).toBe(false);expect(e.beams[0].segments[0].to.x).toBeCloseTo(520);expect(e.hits).toBe(0);
});
test('slow S10 projectile damages but no longer one-shots a full Hammerhead, retaining long cooldown',()=>{
 const e=duel('idris-m','railgun');step(e,1);expect(e.projectiles[0].speed).toBe(680);expect(e.ships[1].alive).toBe(true);
 step(e,120);expect(e.ships[1].alive).toBe(true);expect(e.ships[1].hull+e.ships[1].shield).toBeLessThan(80000);expect(e.ships[0].kills).toBe(0);expect(e.shots).toBe(1);expect(e.ships[0].spec.mounts[0].cooldown*.75).toBe(15);expect(e.ships[0].cooldowns[0]*.75).toBeGreaterThan(13);
});
test('railgun still respects encounter boss burst protection',()=>{
 const e=duel('idris-m','railgun');e.ships[1].npc='boss';step(e,120);expect(e.ships[1].alive).toBe(true);expect(e.ships[1].hull+e.ships[1].shield).toBeGreaterThan((e.ships[1].spec.hull+e.ships[1].spec.shield)*.7);
});
test('torpedoes steer within limits, have bounded trails and enlarged Polaris geometry',()=>{
 const e=duel('polaris','torpedo');step(e,1);const initial=e.projectiles[0];expect(initial.width).toBe(1.7);const angle=initial.angle;e.ships[1].y=450;step(e,60);
 const p=e.projectiles.find(p=>p.kind==='torpedo')!;expect(p.angle).toBeGreaterThan(angle);expect(p.angle-angle).toBeLessThanOrEqual(.65+1e-8);expect(p.trail!.length).toBeLessThanOrEqual(9);expect(p.trail!.length).toBeGreaterThan(3);expect(e.ships[1].alive).toBe(true);
});
test('Gatling fires short bursts with recovery rather than permanent full-rate fire',()=>{
 const e=duel('ares-inferno','ballistic');step(e,60);expect(e.shots).toBe(10);step(e,30);expect(e.shots).toBe(10);step(e,36);expect(e.shots).toBeGreaterThan(10);
});
test('upgrading a pre-feature IndexedDB Idris drops generic guns and adds the spinal beam',()=>{
 const builtin=manifest.assets.find(a=>a.shipId==='idris-p') as ShipAsset;
 const old={...builtin,combatVersion:4,mounts:[{...builtin.mounts[0],id:'laser-1',kind:'laser' as const},{...builtin.mounts[1],x:.123}]};
 const next=upgradeCombat(old,builtin);expect(next.mounts.some(m=>m.kind==='beam')).toBe(true);expect(next.mounts.some(m=>m.id==='laser-1')).toBe(false);expect(next.mounts.find(m=>m.id===builtin.mounts[1].id)!.x).toBe(.123);
 expect(next.mounts).toHaveLength(builtin.mounts.length);
});

test('previously cached weapons receive the new beam damage and 15-second rail cooldown',()=>{
 for(const id of ['idris-p','tiburon','mauler','odin','idris-m']){
  const builtin=manifest.assets.find(a=>a.shipId===id) as ShipAsset;
  const old={...builtin,combatVersion:id==='idris-m'?5:id==='idris-p'||id==='tiburon'||id==='odin'?7:6,mounts:builtin.mounts.map(m=>({...m,damage:1,cooldown:30,...(id==='odin'&&m.id==='spinal-beam'?{beamWidth:60}:{})}))};
  const upgraded=upgradeCombat(old,builtin);
  expect(upgraded.combatVersion).toBe(builtin.combatVersion);expect(upgraded.mounts).toEqual(builtin.mounts);
 }
});

test('railgun damage falls off with travelled distance and other weapons are unaffected',()=>{
 expect(projectileDamage('railgun',90000,200)).toBe(90000);
 expect(projectileDamage('railgun',90000,1300)).toBeCloseTo(65250);
 expect(projectileDamage('railgun',90000,3000)).toBeCloseTo(40500);
 expect(projectileDamage('torpedo',11500,3000)).toBe(11500);
});
test('broad beam can hit a hull overlapping its edge, while still using one total damage budget',()=>{
 const e=duel('odin','beam');step(e,1);const m=e.ships[0].spec.mounts[0];e.ships[1].y=60;step(e,1);expect(e.beams[0].segments[0].hit).toBe(false);e.ships[1].y=m.beamWidth!/2+e.ships[1].spec.beam*.45;step(e,40);
 expect(e.beams[0].segments[0].hit).toBe(true);expect(e.hits).toBeGreaterThan(0);
});

test.each([['idris-p',112500,4.5,14/3],['tiburon',62400,3.9,11/3],['mauler',288000,5.4,14/3],['odin',1400000,6,6]] as const)('%s stronger beam retains its duration, cooldown and single volley budget', (id,total,seconds,cooldown)=>{
 const e=duel(id,'beam'),t=e.ships[1],m=e.ships[0].spec.mounts[0];t.spec={...t.spec,hull:1e8,shield:0,beam:1000};t.hull=1e8;t.shield=0;
 expect(m.duration!*.75).toBeCloseTo(seconds);expect(m.cooldown*.75).toBeCloseTo(cooldown);
 step(e,Math.ceil(m.duration!*60)+2);expect(e.shots).toBe(1);expect(1e8-t.hull).toBeCloseTo(total,3);
});
test('Polaris torpedo impacts once, caps ordinary damage at 55% and keeps boss protection',()=>{
 for(const boss of [false,true]){
  const e=duel('polaris','torpedo'),t=e.ships[1],total=t.spec.hull+t.spec.shield;if(boss)t.npc='boss';
  step(e,300);const lost=total-t.hull-t.shield;expect(e.hits).toBe(1);expect(e.shots).toBe(1);expect(lost).toBeGreaterThan(0);expect(lost).toBeLessThanOrEqual(total*(boss?.2:.55)+1e-6);expect(t.alive).toBe(true);
 }
});

test.each(['idris-p','tiburon','mauler','odin'])('%s brief contact cannot vaporise a fresh fighter',id=>{
 const e=duel(id,'beam');step(e,1);const t=e.ships[1],m=e.ships[0].spec.mounts[0];
 t.spec={...structuredClone(ships.find(s=>s.id==='arrow')!) as ShipSpec,speed:0,acceleration:0,turnRate:0,mounts:[]};t.hull=t.spec.hull;t.shield=t.spec.shield;t.y=(m.emitters?.[0]??0)*e.ships[0].spec.beam;
 const total=t.hull+t.shield;step(e,40);expect(e.hits).toBe(2);expect(t.alive).toBe(true);expect(total-t.hull-t.shield).toBeLessThanOrEqual(total*.25+1e-6);
 step(e,120);expect(t.alive).toBe(false);expect(e.ships[0].kills).toBe(1);
});

test.each(['idris-p','tiburon','mauler','odin'])('%s beam settles five times per 1× second with unchanged DPS',id=>{
 const e=duel(id,'beam'),t=e.ships[1],m=e.ships[0].spec.mounts[0];
 t.spec={...t.spec,hull:1e8,shield:0,beam:1000};t.hull=1e8;t.shield=0;
 step(e,15);expect(e.hits).toBe(0);
 for(let tick=1;tick<=5;tick++){
  step(e,1);expect(e.hits).toBe(tick);expect(1e8-t.hull).toBeCloseTo(m.damage*4/15*tick,3);
  if(tick<5){step(e,15);expect(e.hits).toBe(tick);}
 }
 expect(1e8-t.hull).toBeCloseTo(m.damage*4/3,3);
});

test.each(['brawl','bounty','challenge'] as const)('five-tick beams retain %s boss burst protection',mode=>{
 const e=duel('odin','beam'),t=e.ships[1];e.mode=mode;t.npc='boss';const total=t.hull+t.shield,rule=mode==='brawl'?defenseRules.burst.member:defenseRules.burst[mode];
 step(e,16);expect(e.hits).toBe(1);expect(total-t.hull-t.shield).toBeCloseTo(total*rule.capacity,3);
 step(e,64);expect(e.hits).toBe(5);expect(total-t.hull-t.shield).toBeLessThanOrEqual(total*(rule.capacity+rule.perSecond*64/60)+1e-6);expect(t.alive).toBe(true);
});

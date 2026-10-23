import{expect,test}from'vitest';
import data from'../src/data/ships.json';
import rules from'../src/data/defense-balance.json';
import{BattleEngine}from'../src/sim/engine';
import type{ShipSpec,WeaponKind}from'../src/sim/types';
import{simulationSeconds}from'../src/sim/pacing';

test.each([undefined,'boss','escort'] as const)('current non-boss output gains another 10 percent and continuous beams lose another 10 percent; bosses unchanged: owner %s',npc=>{
 for(const kind of['laser','turret','missile','beam','railgun','torpedo','ballistic'] as WeaponKind[]){
  const base=structuredClone(data.find(s=>s.id==='gladius')!) as ShipSpec;
  const gun={...base.mounts[0],id:'test-weapon',kind,damage:100,cooldown:1000,charge:0,duration:2,facing:0,emitters:[0],x:0,y:0,range:2000};
  const owner={...base,id:'owner',speed:0,acceleration:0,turnRate:0,shieldRegen:0,mounts:[gun]},target={...base,id:'target',speed:0,acceleration:0,turnRate:0,shieldRegen:0,mounts:[],hull:1e6,shield:0};
  const e=new BattleEngine();e.reset([{specId:'owner',count:1},{specId:'target',count:1}],[owner,target],42);e.asteroids=[];
  const[a,b]=e.ships;a.x=a.y=b.y=0;b.x=900;a.heading=b.heading=0;a.npc=npc;a.cooldowns.fill(1000);e.start();
  if(kind==='beam')e.beams=[{owner:a.id,mount:0,remaining:2,elapsed:0,pending:0,segments:[]}];
  else e.projectiles=[{id:999,owner:a.id,target:b.id,kind,x:b.x,y:b.y,vx:1,vy:0,angle:0,speed:1,damage:100,ttl:1,travel:0,range:2000,color:0xffffff}];
  for(let i=0;i<(kind==='beam'?16:1);i++)e.step();
  expect(e.hits,kind).toBe(1);expect(1e6-b.hull,kind).toBeCloseTo(100*(npc==='boss'?1:1.265)*(npc!=='boss'&&kind==='beam'?.9:1)*(!npc&&kind==='beam'?.9:1)*(kind==='beam'?simulationSeconds(.2):1),6);
  expect(a.spec.mounts[0].damage).toBe(100);expect(a.spec.mounts[0].cooldown).toBe(1000);
 }
 expect(rules.nonBossWeaponDamageMultiplier).toBe(1.265);expect(rules.memberBeamDamageMultiplier).toBe(.9);expect(rules.nonBossBeamDamageMultiplier).toBe(.9);
});

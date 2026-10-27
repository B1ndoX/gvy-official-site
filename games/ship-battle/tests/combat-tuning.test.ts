import {expect,test} from 'vitest';
import data from '../src/data/ships.json';
import config from '../src/data/fleet-combat-tuning.json';
import {prepareCombatSpecs as prepareSpecs} from '../src/sim/combat-tuning';
import fleetRules from '../src/data/fleet-gameplay-balance.json';
import {BattleEngine} from '../src/sim/engine';
import type {ShipSpec} from '../src/sim/types';
const source=data as ShipSpec[],rules={...config,enabled:true};
const prepareCombatSpecs=(specs:ShipSpec[],settings:typeof config)=>prepareSpecs(specs,settings,{...fleetRules,enabled:false});
test('encounter tuning changes no member or base ship health, weapons, mobility or source data',()=>{
 const before=JSON.stringify(source),game=prepareCombatSpecs(source,rules),find=(rows:ShipSpec[],id:string)=>rows.find(s=>s.id===id)!;
 expect(find(game,'idris-p').hull).toBe(find(source,'idris-p').hull);
 for(const s of game){const original=find(source,s.id);expect(s.hull).toBe(original.hull);expect(s.shield).toBe(original.shield);expect(s.mounts).toBe(original.mounts);expect(s.speed).toBe(original.speed);expect(s.length).toBe(original.length);expect(s.mass).toBe(original.mass);expect(s.shieldRegen/s.shield).toBeCloseTo(original.shieldRegen/original.shield);}
 expect(JSON.stringify(source)).toBe(before);expect(prepareCombatSpecs(source,{...rules,enabled:false})).toBe(source);
 for(const ship of game){const {encounterTuning,...base}=ship;expect(base).toEqual(find(source,ship.id));expect(encounterTuning).toBeDefined();}
});
test('each new challenge wave uses the same NPC-only curve and preserves every member resource',()=>{
 const specs=prepareCombatSpecs(source,rules),e=new BattleEngine();e.reset([{specId:'gladius',count:2},{specId:'mauler',count:1,npc:'boss'}],specs,31,'challenge');e.start();
 const ids=['mauler','odin','pegasus','bengal','retribution'];
 for(let wave=0;wave<ids.length;wave++){
  const boss=e.snapshot().boss!,base=source.find(s=>s.id===ids[wave])!,ratio=2/32;
  expect(boss.spec.id).toBe(ids[wave]);expect(boss.spec.hull).toBe(Math.round(rules.referenceHull*(base.hull/rules.referenceHull)**rules.hullPower*rules.bossHealth*ratio));
  boss.spec.mounts.forEach((m,i)=>{expect(m.damage).toBeCloseTo(base.mounts[i].damage*rules.bossDamage*Math.sqrt(ratio));expect(m.cooldown).toBe(base.mounts[i].cooldown);expect(m.ammo).toBe(base.mounts[i].ammo);expect(m.fireControl).toBe(base.mounts[i].fireControl);});
  for(const member of e.ships.filter(s=>!s.npc)){expect(member.spec.mounts).toEqual(source.find(s=>s.id===member.spec.id)!.mounts);expect(member.spec.hull).toBe(source.find(s=>s.id===member.spec.id)!.hull);}
  if(wave<ids.length-1){boss.alive=false;e.step();for(let i=0;i<1000&&e.wave===wave+1;i++)e.step();}
 }
});
test('boss difficulty is applied only after the same base conversion, with continuous population scaling',()=>{
 const game=prepareCombatSpecs(source,rules),base=game.find(s=>s.id==='mauler')!;
 for(const count of [2,31,32,33,64]){const e=new BattleEngine();e.reset([{specId:'gladius',count},{specId:'mauler',count:1,npc:'boss'}],game,31,'challenge');e.start();const boss=e.snapshot().boss!,ratio=count/32;
 expect(boss.spec.hull).toBe(Math.round(rules.referenceHull*(base.hull/rules.referenceHull)**rules.hullPower*rules.bossHealth*ratio));expect(boss.spec.mounts[0].damage).toBeCloseTo(base.mounts[0].damage*rules.bossDamage*Math.sqrt(ratio));expect(e.ships[0].spec.hull).toBe(game.find(s=>s.id==='gladius')!.hull);
 }
});
test('enabling the challenge layer leaves seeded PVP trajectories and bounty boss stats unchanged',()=>{
 for(const mode of ['brawl','teams','bounty'] as const){
  const engines=[source,prepareCombatSpecs(source,rules)].map(specs=>{const e=new BattleEngine();e.reset([{specId:'scorpius',count:1,team:'red'},{specId:'gladius',count:1,team:'blue'},{specId:'mauler',count:1,npc:'boss'}],specs,31,mode);e.start();for(let i=0;i<600;i++)e.step();return e;});
  const state=(e:BattleEngine)=>({phase:e.phase,shots:e.shots,hits:e.hits,ships:e.ships.map(s=>({id:s.id,x:s.x,y:s.y,hull:s.hull,shield:s.shield,alive:s.alive,mounts:s.spec.mounts}))});
  expect(state(engines[1])).toEqual(state(engines[0]));
 }
});

import {bossCoverageScale} from '../src/sim/weapons';
import {expect,test} from 'vitest';
import data from '../src/data/ships.json';
import rules from '../src/data/defense-balance.json';
import {bossDefense,bossPopulation} from '../src/sim/balance';
import {BattleEngine} from '../src/sim/engine';
import {battleRoster,BOSS_IDS} from '../src/sim/members';
import type {BattleMode,ShipSpec} from '../src/sim/types';
const specs=data as ShipSpec[];
function setup(count:number,mode:BattleMode){const e=new BattleEngine();e.reset(battleRoster([{specId:'gladius',count}],mode,42),specs,42,mode);e.start();return e;}
test.each(['bounty','challenge'] as BattleMode[])('%s health scales linearly and damage sublinearly from the 32-player encounter',mode=>{
  const reference=setup(32,mode).snapshot().boss!;
  for(const count of [2,8,16,32,64,100]){
    const e=setup(count,mode),boss=e.snapshot().boss!,scale=count/32;
    expect(boss.spec.id).toBe(reference.spec.id);
    expect(Math.abs(boss.spec.hull-reference.spec.hull*scale)).toBeLessThanOrEqual(2);
    expect(Math.abs(boss.spec.shield-reference.spec.shield*scale)).toBeLessThanOrEqual(1);
    boss.spec.mounts.forEach((m,i)=>expect(m.damage).toBeCloseTo(reference.spec.mounts[i].damage*Math.sqrt(scale),6));
    expect(boss.spec.hull).toBe(boss.hull);expect(boss.spec.shield).toBe(boss.shield);
  }
});
test('all five bosses scale without mutating shared ship definitions',()=>{
  const e=setup(32,'challenge'),members=e.ships.filter(s=>!s.npc);
  for(const id of BOSS_IDS){const base=specs.find(s=>s.id===id)!,before=JSON.stringify(base);
    for(const mode of ['bounty','challenge'] as BattleMode[]){
      const full=bossDefense(base,mode,members,32,1),half=bossDefense(base,mode,members.slice(0,16),16,1);
      expect(half.hull).toBeCloseTo(full.hull/2,0);expect(half.shield).toBeCloseTo(full.shield/2,0);
      expect(half.shieldRegen).toBeCloseTo(full.shieldRegen/2,6);
    }expect(JSON.stringify(base)).toBe(before);
  }
});
test('casualties never change the current boss or reduce a later challenge wave',()=>{
  const e=setup(32,'challenge'),members=e.ships.filter(s=>!s.npc),first=e.snapshot().boss!,original={hull:first.hull,shield:first.shield,spec:first.spec};
  members.slice(0,16).forEach(s=>s.alive=false);
  expect(bossDefense(specs.find(s=>s.id==='odin')!,'challenge',members,32,2)).toEqual(bossDefense(specs.find(s=>s.id==='odin')!,'challenge',members.map(s=>({...s,alive:true})),32,2));
  expect({hull:first.hull,shield:first.shield,spec:first.spec}).toEqual(original);
  first.alive=false;e.step();expect(e.nextWaveIn).toBeGreaterThan(0);
  for(let i=0;i<361;i++)e.step();
  const next=e.snapshot().boss!,base=specs.find(s=>s.id==='odin')!;
  expect(next.spec.id).toBe('odin');expect(next.spec.hull).toBe(bossDefense(base,'challenge',members,32,2).hull);
  expect(next.spec.mounts[0].damage).toBeCloseTo(base.mounts[0].damage*bossCoverageScale(base.mounts)*rules.bossDamageMultiplier*rules.challengeDamageMultiplier,6);
});
test('reset uses the new starting roster and ordinary member combat keeps its ship stats',()=>{
  const e=setup(64,'bounty');e.reset(battleRoster([{specId:'gladius',count:8}],'bounty',42),specs,42,'bounty');e.start();
  expect(e.snapshot().boss!.spec.hull).toBe(setup(8,'bounty').snapshot().boss!.spec.hull);
  expect(e.ships.filter(s=>!s.npc).every(s=>s.spec===specs.find(s=>s.id==='gladius'))).toBe(true);
  expect(bossPopulation(0)).toEqual(bossPopulation(1));
});
test('adjacent player counts have no difficulty tiers or sudden jumps',()=>{
  for(let count=2;count<100;count++){
    const current=bossPopulation(count),next=bossPopulation(count+1);
    expect(next.health/current.health).toBeCloseTo((count+1)/count,10);
    expect(next.damage/current.damage).toBeCloseTo(Math.sqrt((count+1)/count),10);
  }
});

import {expect,test} from 'vitest';
import data from '../src/data/ships.json';
import members from '../src/data/members.json';
import {BattleEngine} from '../src/sim/engine';
import {bossDefense} from '../src/sim/balance';
import {assignMemberShips,battleRoster,BOSS_IDS} from '../src/sim/members';
import type {ShipSpec} from '../src/sim/types';
const specs=data as ShipSpec[];
// Long production balance samples live in the frozen multi-batch study. These
// tests verify the source/reference contract rather than asserting a win rate.
test.each([1,2,3,4,5,6,7,8,9,10,42,77])('bounty seed %i starts its sourced boss without a hidden balance modifier',seed=>{
 const e=new BattleEngine();e.reset(battleRoster(assignMemberShips(members.members,specs,seed),'bounty',seed),specs,seed,'bounty');e.start();
 const boss=e.snapshot().boss!,base=specs.find(s=>s.id===boss.spec.id)!;
 expect(e.phase).toBe('running');expect(boss.hull).toBe(base.hull);expect(boss.shield).toBe(base.shield);expect(boss.spec.mounts).toEqual(base.mounts);expect(e.snapshot().memberTotal).toBe(32);
});
test('every ship has finite physical stats and an explicit behavior role',()=>{
 for(const s of specs){expect(s.defenseTier).toBeTruthy();expect(s.defenseRole).toBeTruthy();expect(s.hull).toBeGreaterThan(0);expect(s.shield).toBeGreaterThan(0);expect(Number.isFinite(s.hull+s.shield+s.speed)).toBe(true);}
});
test('all reference bosses retain the same source base across modes, waves and populations',()=>{
 for(const id of BOSS_IDS){const base=specs.find(s=>s.id===id)!;const original=JSON.stringify(base);
  for(const count of [2,32,64])for(const mode of ['bounty','challenge'] as const)for(const wave of [1,5])expect(bossDefense(base,mode,[],count,wave)).toEqual({hull:base.hull,shield:base.shield,shieldRegen:base.shieldRegen});
  expect(JSON.stringify(base)).toBe(original);
 }
});

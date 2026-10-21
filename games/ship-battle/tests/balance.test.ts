import fs from 'node:fs';
import rules from '../src/data/defense-balance.json';
import {test,expect} from 'vitest';
import {bossDefense} from '../src/sim/balance';
import data from '../src/data/ships.json';
import members from '../src/data/members.json';
import {BattleEngine} from '../src/sim/engine';
import {assignMemberShips,battleRoster} from '../src/sim/members';
import type {ShipSpec} from '../src/sim/types';
test.each([1,2,3,4,5,6,7,8,9,10,42,77])('bounty seed %i resolves without a kill-credit winner',seed=>{const e=new BattleEngine();e.reset(battleRoster(assignMemberShips(members.members,data as ShipSpec[],seed),'bounty',seed),data as ShipSpec[],seed,'bounty');e.start();for(let i=0;i<900*60&&e.phase==='running';i++)e.step();const s=e.snapshot();expect(e.phase).toBe('finished');expect(['players','boss']).toContain(s.outcome);if(s.outcome==='players'){expect(s.winner).toBeNull();expect(s.boss?.alive).toBe(false);}else expect(s.memberAlive).toBe(0);},30000);
test('defense follows combat role and tier, including heavy fighters and noncombat transports',()=>{
  const find=(id:string)=>data.find(s=>s.id===id)!;
  expect(find('f8c-lightning').hull).toBeGreaterThan(find('gladius').hull);expect(find('f8c-lightning').shield).toBeGreaterThan(find('arrow').shield);
  expect(find('hornet-mk2').hull).toBeGreaterThan(find('arrow').hull);expect(find('javelin').hull).toBeGreaterThan(find('hull-e').hull);
  expect(data.every(s=>s.defenseTier&&s.defenseRole&&s.hull>0&&s.shield>0)).toBe(true);
});
test('challenge budget grows across waves, fixes defense at spawn and applies its own output coefficient',()=>{
  const specs=data as ShipSpec[],e=new BattleEngine();e.reset(assignMemberShips(members.members,specs,42),specs,42);
  const boss=specs.find(s=>s.id==='mauler')!,bounty=bossDefense(boss,'bounty',e.ships,32,1),first=bossDefense(boss,'challenge',e.ships,32,1),last=bossDefense(boss,'challenge',e.ships,32,5);
  expect(first.hull).toBeGreaterThan(boss.hull*2);expect(last.hull).toBeGreaterThan(first.hull);
  const small=bossDefense(boss,'bounty',e.ships.slice(0,10),10,1);expect(small.hull).toBeLessThan(bounty.hull);
  e.reset(battleRoster(assignMemberShips(members.members,specs,42),'challenge',42),specs,42,'challenge');e.start();const incoming=e.snapshot().boss!;
  incoming.spec.mounts.forEach((m,i)=>expect(m.damage).toBeCloseTo(boss.mounts[i].damage*rules.challengeDamageMultiplier*rules.bossDamageMultiplier,6));const fixed=incoming.spec.hull;e.ships[0].alive=false;for(let i=0;i<60;i++)e.step();expect(incoming.spec.hull).toBe(fixed);
});
test('challenge samples complete and first boss is not a three-second encounter',()=>{
  const specs=data as ShipSpec[],results=[];
  for(const count of [10,30,32])for(const seed of [1,5,21,42]){
    const e=new BattleEngine();e.reset(battleRoster(assignMemberShips(members.members.slice(0,count),specs,seed),'challenge',seed),specs,seed,'challenge');e.start();
    let firstKill:number|null=null,firstHit:number|null=null,topWave=1;const waves:{wave:number;time:number;members:number}[]=[];
    for(let i=0;i<1200*60&&e.phase==='running';i++){e.step();const first=e.ships.find(s=>s.npc==='boss')!;if(first.lastHit>=0&&firstHit===null)firstHit=e.time;if(!first.alive&&firstKill===null)firstKill=e.time;topWave=Math.max(topWave,e.wave);const latest=e.ships.filter(s=>s.npc==='boss').at(-1)!;if(!latest.alive&&!waves.some(w=>w.wave===e.wave))waves.push({wave:e.wave,time:Number(e.time.toFixed(1)),members:e.living.filter(s=>!s.npc).length});}
    expect(e.phase).toBe('finished');if(firstKill!==null)expect(firstKill-(firstHit??0)).toBeGreaterThan(25);
    results.push({count,seed,outcome:e.outcome,time:Number(e.time.toFixed(1)),firstEngagement:firstKill===null?null:Number((firstKill-(firstHit??0)).toFixed(1)),topWave,waves});
  }
  if(process.env.GVY_BALANCE_REPORT)fs.writeFileSync(process.env.GVY_BALANCE_REPORT,JSON.stringify(results,null,2));
  console.log('CHALLENGE_BALANCE',JSON.stringify(results));
},120000);

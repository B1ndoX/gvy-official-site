import {expect,test} from 'vitest';
import data from '../src/data/ships.json';
import roster from '../src/data/members.json';
import {assignMemberShips,withBossFleet} from '../src/sim/members';
import {BattleEngine} from '../src/sim/engine';
import type {ShipSpec} from '../src/sim/types';
const specs=data as ShipSpec[];
test('one random boss and twenty Vanduul escorts deploy independently of members',()=>{const e=new BattleEngine();e.reset(withBossFleet(assignMemberShips(roster.members,specs,42)),specs,42);expect(e.ships).toHaveLength(53);expect(e.ships.filter(s=>s.member)).toHaveLength(32);expect(e.ships.filter(s=>s.npc==='escort')).toHaveLength(20);const boss=e.ships.find(s=>s.npc==='boss')!,base=specs.find(s=>s.id===boss.spec.id)!;expect(boss.member).toBeUndefined();expect(boss.spec.length).toBeCloseTo(base.length);expect(boss.hull).toBe(base.hull);expect(boss.shield).toBe(base.shield);expect(boss.spec.mounts[0].damage).toBe(base.mounts[0].damage);expect(e.snapshot().escortsAlive).toBe(20);expect(e.snapshot().memberTotal).toBe(32);});
test('Vanduul weapons never target or kill allies; physical collisions retain friendly damage',()=>{
 const e=new BattleEngine();e.reset(withBossFleet(assignMemberShips(roster.members.slice(0,10),specs,5)),specs,5);e.start();
 for(let i=0;i<600;i++){e.step();for(const s of e.ships.filter(s=>s.npc)){
  if(s.targetId)expect(e.ships.find(o=>o.id===s.targetId)?.team).not.toBe(s.team);
  for(const id of s.turretTargets.filter(Boolean))expect(e.ships.find(o=>o.id===id)?.team).not.toBe(s.team);
 }}
 // The shared high-speed collision rule also applies to friendly ships.
 for(const record of e.killLog.filter(r=>r.cause!=='collision')){
  const killer=e.ships.find(s=>s.id===record.killerId)!,victim=e.ships.find(s=>s.id===record.victimId)!;
  expect(Boolean(killer.team)&&killer.team===victim.team).toBe(false);
 }
});
test('boss fleet is not stuck fighting itself after all members are eliminated',()=>{const e=new BattleEngine();e.reset(withBossFleet(assignMemberShips(roster.members.slice(0,2),specs,2)),specs);e.ships.filter(s=>s.member).forEach(s=>s.alive=false);e.start();e.step();expect(e.phase).toBe('finished');expect(e.snapshot().winner?.npc).toBe('boss');expect(e.projectiles).toHaveLength(0);});
test('53-ship member and Vanduul battle resolves, reset restores one boss and 20 escorts',()=>{const e=new BattleEngine(),rows=withBossFleet(assignMemberShips(roster.members,specs,42));e.reset(rows,specs,42);e.start();for(let i=0;i<1800*60&&e.phase==='running';i++)e.step();console.log(JSON.stringify({total:53,time:e.time,winner:e.snapshot().winner}));expect(e.phase).toBe('finished');expect(e.living.length).toBeGreaterThan(0);if(e.snapshot().winner?.npc)expect(e.living.every(s=>s.team==='vanduul')).toBe(true);else expect(e.living).toHaveLength(1);expect(e.ships.reduce((n,s)=>n+s.kills,0)+e.collisionDeaths).toBe(e.snapshot().destroyed);e.reset(rows,specs,42);expect(e.snapshot().boss?.hull).toBe(e.snapshot().boss?.spec.hull);expect(e.snapshot().escortsAlive).toBe(20);expect(e.snapshot().recentKills).toEqual([]);},60000);

test('every reference boss uses the same base hull, shield and guns as its member version',()=>{const seen=new Set<string>();for(let seed=0;seed<100&&seen.size<5;seed++){const e=new BattleEngine();e.reset(withBossFleet(assignMemberShips(roster.members.slice(0,2),specs,seed),seed),specs,seed);const boss=e.snapshot().boss!,base=specs.find(s=>s.id===boss.spec.id)!;seen.add(base.id);expect(boss.hull).toBe(base.hull);expect(boss.shield).toBe(base.shield);expect(boss.spec.shieldRegen).toBe(base.shieldRegen);expect(boss.spec.mounts).toEqual(base.mounts);}expect(seen.size).toBe(5);});

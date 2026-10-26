import type { Member, RosterEntry, ShipSpec, Standing, BattleMode } from './types';
import { randomGenerator, mixSeed } from './math';

export const isMemberShip=(spec:ShipSpec)=>!spec.bossOnly&&spec.battleReady!==false&&spec.mounts.some(m=>!m.interceptsOnly);

/** Uniform draw with replacement: every member has the same access to the full pool. */
export function assignMemberShips(members:Member[],specs:ShipSpec[],seed:number):RosterEntry[]{
  const pool=specs.filter(isMemberShip);if(!pool.length)return [];
  const random=randomGenerator(mixSeed(seed)),seen=new Set<string>();
  return members.filter(m=>{if(seen.has(m.handle)||seen.size>=100)return false;seen.add(m.handle);return true;}).map(member=>({specId:pool[Math.floor(random()*pool.length)].id,count:1,member}));
}
export const BOSS_IDS=['mauler','odin','pegasus','bengal','retribution'] as const;
export const MODE_NAMES:Record<BattleMode,string>={bounty:'赏金猎人',brawl:'成员大乱斗',challenge:'挑战模式',teams:'红蓝团队战'};
export function battleRoster(roster:RosterEntry[],mode:BattleMode,seed:number):RosterEntry[]{if(mode==='brawl')return roster;if(mode==='teams')return roster.map((r,i)=>({...r,team:i%2?'blue':'red'}));if(mode==='challenge')return [...roster,{specId:BOSS_IDS[0],count:1,npc:'boss',team:'vanduul'}];return withBossFleet(roster,seed);}
export function withBossFleet(roster:RosterEntry[],seed=2956):RosterEntry[]{const boss=BOSS_IDS[Math.floor(randomGenerator(mixSeed(seed^0xb055))()*BOSS_IDS.length)];return [...roster,{specId:boss,count:1,npc:'boss',team:'vanduul'},{specId:'scythe',count:8,npc:'escort',team:'vanduul'},{specId:'glaive',count:6,npc:'escort',team:'vanduul'},{specId:'blade',count:6,npc:'escort',team:'vanduul'}];}
export function rankMembers(rows:Standing[]):Standing[]{return [...rows].sort((a,b)=>b.kills-a.kills||a.id-b.id);}
export function validateMembers(value:unknown,base:string):Member[]{
  if(!Array.isArray(value)||value.length<2||value.length>100)throw new Error('成员名单需要 2–100 人');
  const seen=new Set<string>();
  return value.map(m=>{
    if(!m||typeof m.handle!=='string'||!m.handle.trim()||m.handle.length>80||typeof m.name!=='string'||!m.name.trim()||m.name.length>80||seen.has(m.handle))throw new Error('成员原名和唯一 handle 必须有效');
    seen.add(m.handle);
    if(typeof m.avatar!=='string'||!m.avatar.trim())throw new Error('成员头像地址不能为空');
    const url=new URL(m.avatar,base);
    if(url.origin!==new URL(base).origin||!/^https?:$/.test(url.protocol))throw new Error('成员头像必须是同源图片地址');
    return {handle:m.handle,name:m.name,avatar:url.href};
  });
}

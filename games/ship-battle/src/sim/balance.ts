import rules from '../data/defense-balance.json';
import type {BattleMode,Ship,ShipSpec} from './types';
import {clamp} from './math';

/** Fixed at encounter creation; taking losses never heals or resizes an existing boss. */
export function bossDefense(base:ShipSpec,mode:BattleMode,members:Ship[],initialCount:number,wave:number){
  const hull=base.hull*(base.id==='retribution'?1:2);
  if(mode==='brawl')return {hull,shield:base.shield,shieldRegen:base.shieldRegen};
  const squad=clamp(Math.sqrt(initialCount/32),.3,1.65),shield=Math.round(base.shield*squad);
  if(mode==='bounty')return {hull:Math.round(hull*squad*rules.bountyDefenseMultiplier),shield:shield*rules.bountyDefenseMultiplier,shieldRegen:base.shieldRegen*squad};
  const dps=members.filter(s=>s.alive&&!s.npc).reduce((sum,s)=>sum+s.spec.mounts.reduce((d,m)=>d+m.damage/m.cooldown*rules.hitEfficiency[m.kind],0),0);
  const living=members.filter(s=>s.alive&&!s.npc).length;
  const reference=initialCount*650*Math.sqrt(living/Math.max(1,initialCount));
  const fleetDps=dps*.35+reference*.65;
  const seconds=rules.challengeSeconds[clamp(wave-1,0,rules.challengeSeconds.length-1)];
  // The target budget estimates actual firing efficiency, not invulnerability or timed damage.
  const budget=Math.max(hull*squad*1.5+shield,fleetDps*seconds*rules.challengeBudgetMultiplier);
  return {hull:Math.round(budget-shield),shield,shieldRegen:base.shieldRegen*squad};
}

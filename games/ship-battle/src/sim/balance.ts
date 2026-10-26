import rules from '../data/defense-balance.json';
import bossRules from '../data/boss-mode-balance.json';
import type {BattleMode,Ship,ShipSpec} from './types';
import {clamp} from './math';
import {weaponDps} from './weapons';
import simulationProfile from '../data/simulation-profile.json';

/** 32 players retain the reference encounter; output grows more gently than health. */
export function bossPopulation(initialCount:number){
  const ratio=Math.max(1,initialCount)/bossRules.populationReference;
  return {health:ratio**bossRules.populationHealthPower,damage:ratio**bossRules.populationDamagePower};
}

/** Fixed at encounter creation; taking losses never heals or resizes an existing boss. */
export function bossDefense(base:ShipSpec,mode:BattleMode,members:Ship[],initialCount:number,wave:number,originalValues=simulationProfile.mode==='reference'){
  const hull=base.hull;
  if(originalValues||mode==='brawl'||mode==='teams')return {hull,shield:base.shield,shieldRegen:base.shieldRegen};
  const squad=bossPopulation(initialCount).health,shield=base.shield*squad;
  if(mode==='bounty')return {hull:Math.round(hull*squad*bossRules.bountyDefenseMultiplier),shield:Math.round(shield*bossRules.bountyDefenseMultiplier),shieldRegen:base.shieldRegen*squad};
  const dps=members.filter(s=>!s.npc).reduce((sum,s)=>sum+s.spec.mounts.reduce((d,m)=>d+weaponDps(m)*rules.hitEfficiency[m.kind],0),0);
  const reference=initialCount*bossRules.referenceMemberDps;
  const fleetDps=dps*bossRules.challengeFleetShare+reference*(1-bossRules.challengeFleetShare);
  const seconds=bossRules.challengeSeconds[clamp(wave-1,0,bossRules.challengeSeconds.length-1)];
  // The target budget estimates actual firing efficiency, not invulnerability or timed damage.
  const budget=Math.max(hull*squad*bossRules.challengeMinimumHullMultiplier+shield,fleetDps*seconds*bossRules.challengeBudgetMultiplier);
  return {hull:Math.round(budget-shield),shield:Math.round(shield),shieldRegen:base.shieldRegen*squad};
}

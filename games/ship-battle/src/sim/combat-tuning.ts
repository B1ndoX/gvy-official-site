import config from '../data/fleet-combat-tuning.json';
import gameplay from '../data/fleet-gameplay-balance.json';
import type {ShipSpec} from './types';
export type CombatTuning=typeof config;
export type GameplayBalance=typeof gameplay;
export function torpedoSpeed(size:number,rules:GameplayBalance=gameplay){return rules.torpedoSpeedAtS5*(5/Math.max(1,size))**rules.torpedoSpeedPower;}

/** Continuous size adjustment; raw catalog values and weapon installation stay intact. */
export function hullRetention(length:number,rules:GameplayBalance=gameplay){
 const progress=Math.max(0,Math.min(1,Math.log(Math.max(rules.hullStartLength,length)/rules.hullStartLength)/Math.log(rules.hullFullLength/rules.hullStartLength)));
 return 1-rules.hullMaxReduction*progress;
}

/** Shared gameplay conversion first, then NPC-only encounter rules at spawn.
 * Neither stage mutates source facts or the installed weapons/mobility/aim rules. */
export function prepareCombatSpecs(specs:ShipSpec[],rules:CombatTuning=config,fleet:GameplayBalance=gameplay):ShipSpec[]{
 if(!rules.enabled&&!fleet.enabled)return specs;
 return specs.map(original=>{
  const spec=fleet.enabled?{...original,hull:Math.round(original.hull*hullRetention(original.length,fleet)),collisionDamageMultiplier:fleet.collisionDamage,mounts:original.mounts.map(m=>({...m,damage:m.damage*fleet.weaponDamage,...(m.kind==='torpedo'&&m.weaponSize?{speed:torpedoSpeed(m.weaponSize,fleet)}:{})}))}:original;
  return rules.enabled?{...spec,encounterTuning:{health:rules.bossHealth,damage:rules.bossDamage,hullReference:rules.referenceHull,shieldReference:rules.referenceShield,hullPower:rules.hullPower,shieldPower:rules.shieldPower,populationReference:rules.populationReference,healthPower:rules.populationHealthPower,damagePower:rules.populationDamagePower}}:spec;
 });
}

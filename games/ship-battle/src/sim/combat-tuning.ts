import config from '../data/fleet-combat-tuning.json';
import type {ShipSpec} from './types';
export type CombatTuning=typeof config;

/** Register encounter rules only. Member and catalog/base boss stats remain
 * the immutable real-data version; NPC difficulty is applied at encounter spawn. */
export function prepareCombatSpecs(specs:ShipSpec[],rules:CombatTuning=config):ShipSpec[]{
 if(!rules.enabled)return specs;
 return specs.map(spec=>({...spec,encounterTuning:{health:rules.bossHealth,damage:rules.bossDamage,hullReference:rules.referenceHull,shieldReference:rules.referenceShield,hullPower:rules.hullPower,shieldPower:rules.shieldPower,populationReference:rules.populationReference,healthPower:rules.populationHealthPower,damagePower:rules.populationDamagePower}}));
}

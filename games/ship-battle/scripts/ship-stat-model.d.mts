import rules from '../src/data/ship-game-balance.json';
export const shipRules:typeof rules;
export const shipFacts:unknown;
export interface FactRecord {id?:string;role?:string;manufacturer?:string;facts:Record<string,number>;geometryConflict?:object;fallbackGeometry?:{length:number;projectionRatio?:number}}
export interface ConvertedStats {estimation:Record<string,unknown>;length:number;mass:number;hull:number;shield:number;shieldRegen:number;speed:number;acceleration:number;turnRate:number;armorPhysicalMultiplier:number;armorEnergyMultiplier:number;estimated:string[]}
export function convertShipFacts(record:FactRecord,rules?:typeof shipRules):ConvertedStats;
export function combatRole(role:string):string;

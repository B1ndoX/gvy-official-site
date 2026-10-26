import {readFile} from 'node:fs/promises';
import {estimateMissingFacts} from './concept-estimates.mjs';
export const shipRules=JSON.parse(await readFile(new URL('../src/data/ship-game-balance.json',import.meta.url),'utf8'));
export const shipFacts=JSON.parse(await readFile(new URL('../src/data/ship-reference-facts.json',import.meta.url),'utf8'));
const profile=JSON.parse(await readFile(new URL('../src/data/simulation-profile.json',import.meta.url),'utf8'));
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n)),round=n=>Number(n.toFixed(6));
/** Same pure conversion for members and boss hulls; no ship ID/role branches. */
export function convertShipFacts(record,rules=shipRules){
 const inferred=estimateMissingFacts(record),f=inferred.record.facts,r=rules.reference,e=rules.estimates,estimated=[];
 const take=(key,fallback)=>{if(record.facts[key]>0)return record.facts[key];estimated.push(key);return f[key]>0?f[key]:fallback;};
 const reference=profile.mode==='reference';
 const length=!reference&&record.geometryConflict?(estimated.push('length:source-conflict'),record.fallbackGeometry.length):take('length',record.fallbackGeometry?.length??r.length),mass=take('mass',r.mass*(length/r.length)**e.massLengthPower);
 const rawHull=take('hullTotal',r.hull*(length/r.length)**e.hullLengthPower),rawShield=take('shieldCapacity',r.shieldCapacity*(length/r.length)**e.shieldLengthPower);
 const scm=take('scm',r.scm*(length/r.length)**e.scmLengthPower),yaw=take('yawDegrees',r.yawDegrees*(mass/r.mass)**e.yawMassPower);
 const hull=reference?rawHull:clamp(rules.hull.referenceValue*(rawHull/r.hull)**rules.hull.power*rules.hull.globalMultiplier,rules.hull.minimum,rules.hull.maximum);
 const shield=reference?rawShield:clamp(rules.shield.referenceValue*(rawShield/r.shieldCapacity)**rules.shield.power*rules.shield.globalMultiplier,rules.shield.minimum,rules.shield.maximum);
 const speed=reference?scm*.75:clamp(rules.mobility.referenceSpeed*(scm/r.scm)**rules.mobility.speedPower,rules.mobility.minimumSpeed,rules.mobility.maximumSpeed);
 const regen=reference?take('shieldRegen',rawShield*rules.shield.recoveryPerSecond)*.75:shield*rules.shield.recoveryPerSecond;
 // No acceleration measurement in the snapshots: estimate response continuously from mass.
 const acceleration=speed/(rules.mobility.responseSeconds*(mass/r.mass)**rules.mobility.massResponsePower);estimated.push('acceleration');
 for(const key of ['physicalDamageMultiplier','energyDamageMultiplier'])if(inferred.basis[key])estimated.push(key);
 return {estimation:inferred.basis,length:round(length),mass:round(mass),hull:Math.round(hull),shield:Math.round(shield),shieldRegen:round(regen),...(reference?{shieldRecoveryDelay:round(take('shieldDelay',5)/.75),shieldDownDelay:round(take('shieldDownDelay',10)/.75)}:{}),speed:round(speed),acceleration:round(clamp(acceleration,4,300)),turnRate:round(clamp(yaw*Math.PI/180*rules.mobility.turnScale,rules.mobility.minimumTurn,rules.mobility.maximumTurn)),armorPhysicalMultiplier:clamp(f.physicalDamageMultiplier??rules.armor.unknownMultiplier,rules.armor.minimumMultiplier,rules.armor.maximumMultiplier),armorEnergyMultiplier:clamp(f.energyDamageMultiplier??rules.armor.unknownMultiplier,rules.armor.minimumMultiplier,rules.armor.maximumMultiplier),estimated};
}

/** Behavior label only; source-derived durability has no role multiplier. */
export function combatRole(role){
 const r=role.toLowerCase();
 if(/重型战斗机|heavy fighter/.test(r))return 'fighter-heavy';
 if(/中型战斗机|medium fighter/.test(r))return 'fighter-medium';
 if(/隐形|stealth/.test(r))return 'stealth';if(/racing/.test(r))return 'racing';
 if(/fighter|战斗机/.test(r))return 'fighter-light';
 if(/armored|military transport|dropship/.test(r))return 'armored-transport';
 if(/gunship|炮|护卫|驱逐|巡逻|bomber|carrier|frigate|destroyer|battle cruiser|dreadnaught|interdiction|boarding|combat patrol|combined arms|minelayer/.test(r))return 'military';
 if(/multi.?role|generalist/.test(r))return 'multirole';return 'civilian';
}

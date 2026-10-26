import {readFile} from 'node:fs/promises';
export const sizeRules=JSON.parse(await readFile(new URL('../src/data/weapon-size-balance.json',import.meta.url),'utf8'));
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n)),positive=n=>Number.isFinite(n)&&n>0;
const median=values=>{const v=values.filter(positive).sort((a,b)=>a-b),mid=Math.floor(v.length/2);return v.length?v.length%2?v[mid]:(v[mid-1]+v[mid])/2:null;};
/** Returns one installed barrel's game parameters; mounting never compresses damage. */
export function sizedGunParameters(weapon,family,catalog,classify){
 const rule=sizeRules.families[family];if(!rule)throw new Error(`Unsupported gun family ${family}`);
 const size=positive(weapon.size)?weapon.size:sizeRules.referenceSize;
 const peers=Object.values(catalog).filter(w=>w.category==='gun'&&w.size===size&&classify(w)===family&&!/M2C|M3C/.test(w.name));
 const scale=size/sizeRules.referenceSize;
 const referenceDamage=median(peers.map(w=>w.damage)),referenceRPM=median(peers.map(w=>w.rpm));
 const modelDamage=positive(weapon.damage)&&referenceDamage?clamp(weapon.damage/referenceDamage,...sizeRules.modelDamageRatio)**sizeRules.modelDamagePower:1;
 const modelCadence=positive(weapon.rpm)&&referenceRPM?clamp(referenceRPM/weapon.rpm,...sizeRules.modelCadenceRatio)**sizeRules.modelCadencePower:1;
 const pace=scale**rule.sizeCadencePower*modelCadence;
 return {damage:rule.damage*scale**sizeRules.damageSizePower*modelDamage,cooldown:Math.max(.04,rule.interval*pace)/.75,
  ...(rule.burstCount?{burstCount:rule.burstCount,burstCooldown:rule.burstRecovery*pace/.75}:{})};
}


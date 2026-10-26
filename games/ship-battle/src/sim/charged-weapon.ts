import rules from '../data/weapon-behavior-rules.json';
import type {Mount,Ship} from './types';
import {clamp} from './math';
import {simulationSeconds,battleSeconds} from './pacing';

export const weaponBehavior=(id?:string)=>(rules.weapons as Record<string,typeof rules.weapons['s10-destroyer-mass-driver-cannon']>)[id??''];
export const chargedWeapon=(m:Mount)=>m.kind==='railgun'&&!!m.charge?weaponBehavior(m.weaponId)?.charge:undefined;
export function chargeDamageMultiplier(m:Mount,elapsed:number){
  const rule=chargedWeapon(m);if(!rule)return 1;
  const min=simulationSeconds(rule.minimumSeconds),max=Math.min(m.charge!,simulationSeconds(rule.maximumSeconds));
  const progress=max>min?clamp((elapsed-min)/(max-min),0,1):1;
  return rule.minimumDamageMultiplier+(rule.maximumDamageMultiplier-rule.minimumDamageMultiplier)*progress;
}
export function chooseChargeGoal(m:Mount,owner:Ship,target:Ship,random:()=>number){
  const rule=chargedWeapon(m)!;
  const dx=target.x-owner.x,dy=target.y-owner.y,angular=Math.abs(dx*target.vy-dy*target.vx)/Math.max(1,dx*dx+dy*dy);
  // A fleeting fighter window favours a shorter charge; a steady large hull
  // allows more energy. The combat PRNG preserves variation and reproducibility.
  const fleeting=target.spec.length<65&&angular>.03,roll=random(),fraction=fleeting?roll*.45:.45+roll*.55;
  const maximum=Math.min(rule.maximumSeconds,battleSeconds(m.charge!)),minimum=Math.min(rule.minimumSeconds,maximum);
  return simulationSeconds(minimum+(maximum-minimum)*fraction);
}

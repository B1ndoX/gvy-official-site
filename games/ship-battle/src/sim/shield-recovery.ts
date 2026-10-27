import rules from '../data/defense-balance.json';
import type {ShipSpec} from './types';
import {clamp} from './math';
import {simulationSeconds} from './pacing';

/** Shared game adaptation, in 1x battle seconds. Sourced generator data stays intact. */
export function naturalShieldRecovery(spec:Pick<ShipSpec,'length'|'shield'|'shieldRegen'>){
 const r=rules.naturalShieldRecovery;
 const size=Math.max(0,Math.log(Math.max(r.smallLength,spec.length)/r.smallLength)/Math.log(r.mediumLength/r.smallLength));
 const delaySeconds=clamp(r.smallDelaySeconds+(r.mediumDelaySeconds-r.smallDelaySeconds)*size,r.smallDelaySeconds,r.maximumDelaySeconds);
 const rechargeSeconds=clamp(r.smallRechargeSeconds+(r.mediumRechargeSeconds-r.smallRechargeSeconds)*size,r.smallRechargeSeconds,r.maximumRechargeSeconds);
 // A ship without a working/sourced generator does not acquire one here.
 return {delay:simulationSeconds(delaySeconds),perSecond:spec.shieldRegen>0?spec.shield/simulationSeconds(rechargeSeconds):0,delaySeconds,rechargeSeconds};
}

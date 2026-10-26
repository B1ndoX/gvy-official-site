import {shipRules} from './ship-stat-model.mjs';
import {loadouts,catalog,family,referenceMode,referenceGunParameters,turretTurnRate} from './fleet-weapon-mapping.mjs';
import {sizedGunParameters} from './weapon-size-model.mjs';
/** Missing lists stay explicit estimates, using the same size/category table as sourced guns. */
export function applyEstimatedWeapons(ships){
 const rule=shipRules.estimatedWeapons;
 for(const ship of ships){
  if(loadouts[ship.id]?.status!=='fallback')continue;
  for(const mount of ship.mounts){
   if(mount.interceptsOnly)continue;
   if(mount.kind==='beam'||mount.kind==='railgun'){
    if(referenceMode){const size=mount.weaponSize??10;mount.damage=mount.kind==='beam'?15000*(size/10)**2*.75:144160*(size/10)**1.65;mount.controlSource='unverified-forward-fallback';mount.fireControl='pilot';}
    continue;
   }
   const guided=mount.kind==='missile'||mount.kind==='torpedo';
   const size=guided?rule.missileSize:Math.max(1,Math.min(12,Math.round(rule.mainSizeAt100m*(ship.length/100)**rule.sizeLengthPower)+(mount.role==='point-defense'?rule.supportSizeOffset:0)));
   const type=guided?'missile':mount.role==='point-defense'||mount.kind==='laser'?'repeater':'energy-cannon';
   mount.weaponId=`estimated-s${size}-${type}`;mount.weaponSize=size;mount.weaponName=`模拟S${size}${guided?'导弹':type==='repeater'?'激光速射炮':'激光加农炮'}`;
   if(guided){const raw=3200*(size/3)**2;Object.assign(mount,{damage:Number((referenceMode?raw:raw*(.1+.65/(1+(size/3)**2.5))).toFixed(6)),cooldown:(7+size*.8)/.75,ammo:rule.missileCapacity});}
   else if(referenceMode){delete mount.burstCount;delete mount.burstCooldown;Object.assign(mount,referenceGunParameters({size},type),{controlSource:'unverified-installation',fireControl:mount.kind==='turret'?'manned':'pilot'});if(mount.kind==='turret')mount.turnRate=turretTurnRate(size);}
   else Object.assign(mount,sizedGunParameters({size},type,catalog,family));
  }
 }
 return ships;
}

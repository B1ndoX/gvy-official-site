import {gameWeaponValues,FLEET_WEAPON_VERSION,catalog,family,referenceMode,referenceGunParameters} from './fleet-weapon-mapping.mjs';
import {sizeRules,sizedGunParameters} from './weapon-size-model.mjs';
/** Shared table writer input for both weapon-only and complete fleet generation. */
export function weaponValueTable(){
 const sizeBands=Object.fromEntries(Array.from({length:12},(_,i)=>{const size=i+1;return [size,Object.fromEntries(Object.keys(sizeRules.families).map(type=>[type,referenceMode?referenceGunParameters({size},type):sizedGunParameters({size},type,catalog,family)]))];}));
 return {version:2,mode:referenceMode?'reference':'balanced',fleetWeaponVersion:FLEET_WEAPON_VERSION,timeUnit:'simulation seconds; multiply cooldown by 0.75 for real seconds at 1x; source speeds and beam DPS multiply by 0.75 on import',sizeRules,sizeBands,weapons:gameWeaponValues};
}

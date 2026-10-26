import type {Mount,Ship,WeaponCycle} from './types';
import rules from '../data/weapon-resource-rules.json';
import {simulationSeconds} from './pacing';

export const kineticGun=(kind:string)=>kind==='ballistic'||kind==='railgun';
export function weaponCycle(ship:Ship,index:number):WeaponCycle{
 const m=ship.spec.mounts[index],cycles=ship.weaponCycles??(ship.weaponCycles=[]);
 return cycles[index]??(cycles[index]={chargeLeft:-1,burstLeft:0,...(m.ammo!==undefined?{ammoLeft:m.ammo}:{}),...(m.capacitor!==undefined?{energyLeft:m.capacitor}: {})});
}
/** Runs on the existing simulation clock, including intermission and no-target
 * time. Pausing/finishing cannot refill weapons; reset creates fresh ships. */
export function rechargeWeapons(ship:Ship,time:number,dt:number){
 ship.spec.mounts.forEach((m,i)=>{
  if(!m.capacitor||m.interceptsOnly)return;
  const cycle=weaponCycle(ship,i),since=cycle.lastEnergyShot??-Infinity;
  // Only the part of this step after the recovery delay may recharge.
  const elapsed=Math.max(0,Math.min(dt,time-since-simulationSeconds(rules.capacitor.rechargeDelaySeconds)));
  cycle.energyLeft=Math.min(m.capacitor,(cycle.energyLeft??m.capacitor)+m.capacitor*elapsed/simulationSeconds(rules.capacitor.emptyToFullSeconds));
  if(cycle.energyLocked&&cycle.energyLeft>=Math.max(m.barrels??1,m.capacitor*rules.capacitor.resumeFraction)-1e-8)cycle.energyLocked=false;
 });
}
export function energyReady(m:Mount,cycle:WeaponCycle,rounds:number){
 if(!m.capacitor)return true;
 if(cycle.energyLocked)return false;
 if((cycle.energyLeft??m.capacitor)+1e-8<rounds){cycle.energyLocked=true;return false;}
 return true;
}
export function spendEnergy(m:Mount,cycle:WeaponCycle,rounds:number,time:number){
 if(!m.capacitor)return;
 cycle.energyLeft=Math.max(0,(cycle.energyLeft??m.capacitor)-rounds);cycle.lastEnergyShot=time;
 if(cycle.energyLeft<(m.barrels??1)-1e-8)cycle.energyLocked=true;
}

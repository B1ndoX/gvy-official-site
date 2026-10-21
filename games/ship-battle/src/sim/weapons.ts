import type { Mount } from './types';
export const guidedWeapon = (m:Pick<Mount,'kind'>)=>m.kind==='missile'||m.kind==='torpedo';
export const fixedWeapon = (m:Pick<Mount,'kind'>)=>['laser','beam','railgun','ballistic'].includes(m.kind);
/** Full cycle, including beam uptime/charge or Gatling burst recovery. */
export function weaponDps(m:Mount){
  if(m.kind==='beam')return m.damage*(m.duration??1)/((m.duration??1)+m.cooldown+(m.charge??0));
  if(m.burstCount)return m.damage*m.burstCount/((m.burstCount-1)*m.cooldown+(m.burstCooldown??m.cooldown));
  return m.damage/(m.cooldown+(m.charge??0));
}

/** Range falloff belongs to the projectile, never the frame rate or target class. */
export function projectileDamage(kind:string,base:number,travel:number){
  if(kind!=='railgun')return base;
  const falloff=Math.max(0,Math.min(1,(travel-400)/1800));
  return base*(1-.55*falloff);
}

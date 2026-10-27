import artwork from '../data/ordnance-visuals.json';
import type {Projectile} from '../sim/types';
const known=new Set(artwork.assets.map(a=>a.weaponId));
const sizes:Record<number,string>={1:'s1-spark-i-missile',2:'s2-dominator-ii-missile',3:'s3-thunderbolt-iii-missile',4:'s4-raptor-iv-missile',5:'s5-reaper-v-missile',9:'s9-seeker-ix-torpedo',10:'s10-vt-t10-veritas-torpedo',12:'s12-calamity-xii-torpedo'};
/** Model-specific when present, otherwise a same-size visual only. */
export function ordnanceArtworkID(p:Pick<Projectile,'weaponId'|'weaponSize'|'kind'>){
 if(p.weaponId&&known.has(p.weaponId))return p.weaponId;
 const size=Math.round(p.weaponSize??Number(p.weaponId?.match(/(?:^|-)s(\d+)(?:-|$)/)?.[1]??(p.kind==='torpedo'?5:2)));
 return sizes[size];
}

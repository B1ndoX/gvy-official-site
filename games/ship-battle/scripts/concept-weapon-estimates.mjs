import {analogue,mission} from './concept-estimates.mjs';
import {catalog,loadouts,family,referenceGunParameters,turretTurnRate} from './fleet-weapon-mapping.mjs';
const kinetic=w=>/实弹|电磁|Gatling|Mass Driver/.test(w.type+' '+w.name)&&!w.type.includes('激光');
/** Keep published size/count/installation, infer only an unpublished model.
 * A cargo hull's unknown gun follows a cargo donor, never a carrier's battery. */
export function applyConceptWeapons(ships){
 const audit={};
 for(const ship of ships){
  const record=loadouts[ship.id];if(!mission(ship).functional||!['reference','fallback'].includes(record?.status)||ship.battleReady===false)continue;
  const suggested=analogue(ship),donor=suggested&&ships.find(s=>s.id===suggested.id);
  if(!donor||loadouts[donor.id]?.status!=='snapshot')continue;
  const guns=donor.mounts.filter(m=>!m.interceptsOnly&&catalog[m.weaponId]?.category==='gun');
  if(!guns.length)continue;
  audit[ship.id]={referenceShip:donor.id,mission:mission(ship).category,weapons:[]};
  for(const m of ship.mounts){
   const original=catalog[m.weaponId];if(!original?.referenceOnly||['missile','torpedo','beam','railgun'].includes(m.kind)||m.interceptsOnly)continue;
   const donorGun=[...guns].sort((a,b)=>Math.abs(a.weaponSize-m.weaponSize)-Math.abs(b.weaponSize-m.weaponSize))[0],w=catalog[donorGun.weaponId],f=family(w);
   const peers=Object.values(catalog).filter(p=>!p.referenceOnly&&p.category==='gun'&&family(p)===f&&kinetic(p)===kinetic(w)&&p.damage>0&&p.rpm>0&&!p.interceptsOnly&&!/M2C|M3C/.test(p.name));
   const prefix=w.name.match(/^[A-Za-z]+[- ]/)?.[0];
   const peer=peers.sort((a,b)=>Math.abs(a.size-m.weaponSize)-Math.abs(b.size-m.weaponSize)||(prefix?(b.name.startsWith(prefix)?1:0)-(a.name.startsWith(prefix)?1:0):0)||a.id.localeCompare(b.id))[0]??w;
   Object.assign(m,referenceGunParameters({...peer,size:m.weaponSize,damage:peer.size===m.weaponSize?peer.damage:null,rpm:peer.size===m.weaponSize?peer.rpm:null},f));
   m.weaponName=`模拟${kinetic(peer)?f==='gatling'?'实弹加特林':'实弹加农炮':f==='repeater'?'激光速射炮':'激光加农炮'}`;
   m.estimatedFrom={shipId:donor.id,weaponId:peer.id};
   if(m.kind==='turret'){if(kinetic(peer))m.projectileKind='ballistic';else delete m.projectileKind;m.turnRate=turretTurnRate(m.weaponSize);}
   else m.kind=kinetic(peer)?'ballistic':'laser';
   audit[ship.id].weapons.push({mountId:m.id,size:m.weaponSize,count:m.barrels??1,referenceWeapon:peer.id});
  }
 }
 return audit;
}

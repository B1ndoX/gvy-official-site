import {readFile} from 'node:fs/promises';
import {sizedGunParameters} from './weapon-size-model.mjs';
const root=new URL('../src/data/',import.meta.url);
export const catalog=JSON.parse(await readFile(new URL('weapon-catalog.json',root),'utf8')).weapons;
export const loadouts=JSON.parse(await readFile(new URL('fleet-weapon-loadouts.json',root),'utf8')).ships;
const reviewedProfiles=JSON.parse(await readFile(new URL('weapon-profiles.json',root),'utf8')).ships;
const anchors=JSON.parse(await readFile(new URL('weapon-anchor-layouts.json',root),'utf8')).ships;
const stations=JSON.parse(await readFile(new URL('weapon-stations.json',root),'utf8')).ships;
const fittingRules=JSON.parse(await readFile(new URL('weapon-fitting-rules.json',root),'utf8')).ships;
const behaviorRules=JSON.parse(await readFile(new URL('weapon-behavior-rules.json',root),'utf8')).weapons;
const simulation=JSON.parse(await readFile(new URL('simulation-profile.json',root),'utf8'));
export const referenceMode=simulation.mode==='reference';
const PACE=.75;
export const FLEET_WEAPON_VERSION=JSON.parse(await readFile(new URL('ship-game-balance.json',root),'utf8')).combatVersion;
const fittingFor=id=>fittingRules[fittingRules[id]?.aliasOf??id];
export const fittingVersion=id=>fittingFor(id)?.combatVersion??0;
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n)),round=n=>Number(n.toFixed(6));
export const usesFleetWeapons=id=>['snapshot','reference','unarmed'].includes(loadouts[id]?.status);
export function family(w){if(w.family)return w.family;const type=w.type+' '+w.name+' '+w.nameZh;
 if(w.category==='ordnance')return /鱼雷|Torpedo/.test(type)?'torpedo':'missile';
 const known={'实弹加特林':'gatling','实弹加农炮':'ballistic-cannon','电磁加农炮':'ballistic-cannon','激光加农炮':'energy-cannon','激光速射炮':'repeater','激光束':'beam'}[w.type];if(known)return known;
 if(/激光束/.test(type))return 'beam';if(/畸变/.test(type))return 'distortion';
 if(/加特林|Gatling/.test(type))return /激光/.test(type)?'repeater':'gatling';
 if(/霰弹/.test(type))return 'scatter';if(/速射|Repeater/.test(type))return 'repeater';
 return /实弹|电磁|Mass Driver|WHIP|WARLORD/.test(type)?'ballistic-cannon':'energy-cannon';
}
const median=values=>{const v=values.filter(n=>n>0).sort((a,b)=>a-b);return v.length?v[Math.floor(v.length/2)]:null;};
const ballisticWeapon=w=>/实弹|电磁|Gatling|Mass Driver|WHIP|WARLORD/.test(w.type+' '+w.name+' '+w.nameZh)&&!w.type.includes('激光');
function gunResources(w){
 if(w.category!=='gun'||family(w)==='beam'||w.interceptsOnly||/M2C|M3C/.test(w.name))return undefined;
 const ballistic=ballisticWeapon(w),peers=Object.values(catalog).filter(p=>p.category==='gun'&&p.ammoCapacity>0&&family(p)===family(w)&&ballisticWeapon(p)===ballistic);
 const nearest=peers.length?Math.min(...peers.map(p=>Math.abs(p.size-w.size))):0;
 const capacity=w.ammoCapacity>0?w.ammoCapacity:median(peers.filter(p=>Math.abs(p.size-w.size)===nearest).map(p=>p.ammoCapacity))??(ballistic?600:75);
 return {kind:ballistic?'ballistic':'energy',capacityPerBarrel:Math.max(1,Math.round(capacity)),estimated:!(w.ammoCapacity>0)};
}
/** Unknown models use same-family source medians, explicitly marked as estimates. */
export function referenceGunParameters(w,type=family(w)){
 const peers=Object.values(catalog).filter(p=>!p.referenceOnly&&p.category==='gun'&&family(p)===type&&!p.interceptsOnly&&p.damage>0&&p.rpm>0);
 const nearest=peers.length?Math.min(...peers.map(p=>Math.abs(p.size-w.size))):0;
 const candidates=peers.filter(p=>Math.abs(p.size-w.size)===nearest);
 const damage=w.damage>0?w.damage:median(candidates.map(p=>p.damage*(w.size/p.size)**1.65))??100*(w.size/3)**1.65;
 const rpm=w.rpm>0?w.rpm:median(candidates.map(p=>p.rpm*(p.size/w.size)**.35))??150;
 return {damage:round(damage),cooldown:round(60/rpm/PACE),speed:round((w.speed>0?w.speed:1000)*PACE)};
}
export function turretTurnRate(size){const r=simulation.turrets;return round(clamp(2*r.referenceTurnRate/(1+(size/r.referenceSize)**r.sizePower),r.minimumTurnRate,r.maximumTurnRate));}
function activeStations(shipId,weaponId){
 const records=stations[shipId]?.systems[weaponId]?.stations??[];
 const exclusions=(fittingFor(shipId)?.exclusions??[]).filter(rule=>rule.weaponId===weaponId);
 const result=records.filter(st=>!exclusions.some(rule=>stations[shipId]?.systems[rule.whenStationAlsoHas]?.stations.some(other=>other.stationId===st.stationId)));
 if(exclusions.length&&records.reduce((n,s)=>n+s.count,0)-result.reduce((n,s)=>n+s.count,0)!==exclusions.reduce((n,r)=>n+r.inactiveCount,0))throw Error(`Gunner exclusion source changed; review ${shipId} ${weaponId} before generating`);
 const overrides=fittingFor(shipId)?.overrides?.filter(rule=>rule.weaponId===weaponId)??[];
 if(overrides.length){
  const available=result.reduce((n,s)=>n+s.count,0);
  if(overrides.some(override=>!Number.isInteger(override.activeCount)||override.activeCount<1)||overrides.reduce((n,override)=>n+override.activeCount,0)>available)throw Error(`Invalid active fitting count: ${shipId} ${weaponId}`);
  return overrides.map(override=>({count:override.activeCount,control:override.control,stationId:override.stationId,anchorId:override.anchorId,match:'user-confirmed-fitting'}));
 }
 return result;
}
/** First establish one shared model table; fitting a ship only assigns count shares. */
export const gameWeaponValues=Object.fromEntries(Object.values(catalog).map(w=>{
 const type=family(w),signature=reviewedProfiles.flatMap(p=>p.mounts).find(m=>m.weaponId===w.id&&m.id!=='sf7b-gatling');
 let combat;
 if(w.interceptsOnly||/M2C|M3C/.test(w.name)){combat={interceptsOnly:true,cooldown:.8,range:650,turnRate:2.3};}
 else if(referenceMode&&type==='beam'){
  const r=simulation.estimatedBeam,dps=w.dps>0?w.dps:r.referenceDps*(w.size/r.referenceSize)**r.sizePower;
  combat={damage:dps*PACE,cooldown:signature?.cooldown??8,duration:signature?.duration??6,charge:signature?.charge??.8};
 }else if(referenceMode&&w.category==='gun')combat=referenceGunParameters(w,type);
 else if(referenceMode)combat={damage:w.damage>0?w.damage:(type==='torpedo'?650000*(w.size/10)**2.4:3200*(w.size/3)**2),speed:(w.speed>0?w.speed:500)*PACE,cooldown:signature?.cooldown??(type==='torpedo'?12+Math.max(0,w.size-5)*.8:7+w.size*.8)/PACE};
 else if(signature){combat=Object.fromEntries(['damage','cooldown','charge','duration','burstCount','burstCooldown','cooldownJitter'].filter(k=>signature[k]!==undefined).map(k=>[k,signature[k]]));}
 else if(w.category==='gun'){combat=sizedGunParameters(w,type,catalog,family);}
 else {const torpedo=type==='torpedo',raw=w.damage>0?w.damage:torpedo?650000*(w.size/10)**2.4:3200*(w.size/3)**2;combat={damage:round(raw*(.1+.65/(1+(w.size/3)**2.5))),cooldown:(torpedo?12+Math.max(0,w.size-5)*.8:7+w.size*.8)/.75};}
 combat=Object.fromEntries(Object.entries(combat).map(([key,value])=>[key,typeof value==='number'?round(value):value]));
 return [w.id,{name:w.nameZh,size:w.size,family:type,reviewed:!!signature,source:{damage:w.damage??null,rpm:w.rpm??null,dps:w.dps??null,speed:w.speed??null,ammoCapacity:w.ammoCapacity??null,type:w.type},resources:gunResources(w),estimated:!!w.referenceOnly||(type==='beam'?!(w.dps>0):w.category==='ordnance'?!(w.damage>0):!(w.damage>0&&w.rpm>0)),combat}];
}));
/** These already reviewed primary weapons retain their own timing/damage rules. */
export function signaturePrimary(shipId,w){
 return shipId==='perseus'&&/Medusa/.test(w.name)||shipId==='polaris'&&w.size===10&&family(w)==='torpedo'||shipId==='idris-m'&&w.size===10||['tiburon','mauler','odin'].includes(shipId)&&family(w)==='beam'||shipId==='ares-inferno'&&/SF7B/.test(w.name);
}
/** Fixed counts and real weapon families, with shared game-scale conversions. */
export function applyFleetWeapons(ships){
 for(const ship of ships){
  const record=loadouts[ship.id];if(!usesFleetWeapons(ship.id))continue;
  if(record.status==='unarmed'){ship.mounts=[];continue;}
  const protectedIds={perseus:['turret-2','turret-3'],polaris:['missile-rack'],'idris-p':['spinal-beam'],'idris-m':['s10-railgun'],tiburon:['spinal-beam'],mauler:['spinal-beam'],odin:['spinal-beam'],'ares-inferno':['sf7b-gatling'],'retaliator-base':['missile-1'],'retaliator-bomber':['missile-1']};
  const points=anchors[ship.id].filter(p=>!p.id.startsWith('coverage-turret-')),reserved=new Set(protectedIds[ship.id]??[]),used=new Set(),result=[];
  const missileOnly=record.systems.every(system=>catalog[system.weaponId].category==='ordnance');
  const pick=(kind,role)=>{
   const eligible=points.filter(p=>!reserved.has(p.id)&&!used.has(p.id));
   const point=eligible.find(p=>role==='point-defense'&&p.role==='point-defense')??eligible.find(p=>kind==='missile'||kind==='torpedo'?['missile','torpedo'].includes(p.kind):kind==='turret'?p.kind==='turret':['laser','ballistic'].includes(p.kind))??eligible[0];
   if(!point)throw new Error(`Not enough alpha-safe weapon anchors: ${ship.id}`);used.add(point.id);return point;
  };
  for(const system of record.systems){
   const w=catalog[system.weaponId];if(!w)throw new Error(`Missing weapon ${system.weaponId}`);
   if(signaturePrimary(ship.id,w))continue;
   const f=family(w);if(f==='beam')throw new Error(`Unreviewed primary beam ${ship.id}`);
   if(f==='missile'||f==='torpedo'){
    const point=pick(f,'anti-capital'),torpedo=f==='torpedo';
    const parameters=gameWeaponValues[w.id].combat;
    result.push({id:point.id,kind:f,x:point.x,y:point.y,facing:0,arc:torpedo?100:150,range:torpedo?2600:1900,
     damage:parameters.damage,cooldown:round(missileOnly?(1.5+w.size*.25)/.75:parameters.cooldown??(torpedo?12+Math.max(0,w.size-5)*.8:7+w.size*.8)/PACE),speed:referenceMode?parameters.speed:round(torpedo?clamp(w.speed*.8,240,440):clamp(w.speed*.65,420,850)),turnRate:torpedo?.5:1.6,
     role:torpedo?'anti-capital':'main',ammo:system.count,...(missileOnly?{ammoReload:20/.75}:{}),weaponId:w.id,weaponName:w.nameZh,weaponSize:w.size,width:torpedo?1:1.1});continue;
   }
   const ballistic=/实弹|电磁|Gatling|Mass Driver|WHIP|WARLORD/.test(w.type+' '+w.name+' '+w.nameZh)&&!w.type.includes('激光');
   const interceptOnly=w.interceptsOnly||/M2C|M3C/.test(w.name),defense=interceptOnly||ship.doctrine==='escort'&&(f==='repeater'||f==='gatling');
   const role=defense?'point-defense':w.size>=6?'anti-capital':'main';
   const installed=activeStations(ship.id,w.id);
   const groups=interceptOnly?Array.from({length:Math.min(2,system.count)},(_,i)=>({count:Math.floor(system.count/2)+(i<system.count%2?1:0),control:'pdc',stationId:`pdc-${i}`,match:'interception-adapter'})):installed.length?installed:[{count:system.count,control:'pilot',stationId:`unverified-${w.id}`,match:'unverified-forward-fallback'}];
   for(const station of groups){let left=station.count;
   while(left>0){
    const forward=station.control==='pilot';
    const turret=!forward,kind=turret?'turret':ballistic?'ballistic':'laser';
    // Shared turret aim does not merge damage: every installed barrel launches a round.
    const group=forward?Math.min(2,left):station.count;
    const count=Math.min(group,left),point=station.anchorId?points.find(p=>p.id===station.anchorId&&!reserved.has(p.id)&&!used.has(p.id)):pick(kind,role);left-=count;
    if(!point)throw Error(`Unavailable fitting anchor: ${ship.id} ${station.anchorId}`);used.add(point.id);
    const cannon=f.includes('cannon')||f==='scatter',cadence=cannon?(60/w.rpm)*clamp(1+(w.size-3)*.15,1,1.7):60/w.rpm;
    const mount={id:point.id,kind,x:point.x,y:point.y,facing:turret?point.facing:0,arc:turret?(station.arc??360):60,fireControl:station.control,stationId:station.stationId,controlSource:station.match,
     range:defense?1100:cannon?2000:1500,damage:round(w.damage*(f==='gatling'?.55:f==='scatter'?.2:.4)),
     cooldown:round(clamp(cadence/.75,cannon?.38:.24,5)),speed:round(clamp(w.speed*(cannon?.58:.8),350,1450)),
     turnRate:turret?turretTurnRate(w.size):3,
     role,weaponCount:count,...(!interceptOnly&&count>1?{barrels:count,barrelSpacing:.8}:{}),weaponId:w.id,weaponName:w.nameZh,weaponSize:w.size,color:['gatling','ballistic-cannon'].includes(f)?0xffc586:f==='distortion'?0xb79aff:0x82cfff};
    if(interceptOnly)Object.assign(mount,{interceptsOnly:true,damage:1,range:650,cooldown:.8,turnRate:2.3});
    if(turret&&ballistic)mount.projectileKind='ballistic';
    if(f==='gatling')Object.assign(mount,{cooldown:.08,burstCount:4,burstCooldown:.45});
    if(f==='scatter')Object.assign(mount,{pellets:3,scatterAngle:.09,range:850});
    if(f==='distortion')mount.damageType='distortion';
    result.push(mount);
   }
   }
  }
  ship.mounts=result;
 }
 return ships;
}

/** Weapon size/model determines firepower; ship length and old DPS budgets do not. */
export function applyFleetGunFirepower(ships,profiles){
 for(const ship of ships){
  if(!usesFleetWeapons(ship.id)||loadouts[ship.id].status==='unarmed')continue;
  const profile=profiles.find(p=>p.id===ship.id),protectedIds=new Set(ship.id==='eclipse'?[]:(profile?.mounts??[]).filter(m=>!['missile','torpedo'].includes(m.kind)&&m.id!=='sf7b-gatling').map(m=>m.id));
  const guns=ship.mounts.filter(m=>!m.interceptsOnly&&(referenceMode||!['missile','torpedo'].includes(m.kind)&&!protectedIds.has(m.id))&&catalog[m.weaponId]);
  for(const m of guns){
   const parameters=gameWeaponValues[m.weaponId].combat;
   if(referenceMode&&catalog[m.weaponId].category==='gun'&&m.kind!=='beam'){delete m.burstCount;delete m.burstCooldown;delete m.cooldownJitter;}
   Object.assign(m,parameters);m.damage=round(parameters.damage);m.cooldown=round(m.cooldown);
   const behavior=behaviorRules[m.weaponId];
   if(behavior&&m.kind==='railgun'){
    m.speed=round(m.speed*behavior.projectileSpeedMultiplier);
    if(m.charge)m.charge=simulation.mode==='reference'?behavior.charge.maximumSeconds/PACE:m.charge;
   }
   if(referenceMode&&m.kind==='railgun'&&m.charge)m.cooldown=round(Math.max(.05,m.cooldown-m.charge));
   if(!m.fireControl&&!['missile','torpedo'].includes(m.kind)){
    const compatible=activeStations(ship.id,m.weaponId),same=ship.mounts.filter(other=>other.weaponId===m.weaponId),station=compatible[same.indexOf(m)];
    m.fireControl=station?.control??'pilot';m.stationId=station?.stationId??`reviewed-${m.id}`;m.controlSource=station?.match??'reviewed-forward-primary';
    m.weaponCount=m.barrels??1;
   }
   if(m.kind==='turret'){m.turnRate=turretTurnRate(m.weaponSize??3);m.arc=360;}
   if(m.burstCooldown!==undefined)m.burstCooldown=round(m.burstCooldown);
  }
 }
 return ships;
}

/** Ammunition belongs to installed barrels, never to pellets or a ship-name buff.
 * Energy card capacity is a weapon-level reference, not a verified ship capacitor. */
export function applyWeaponResources(ships){
 for(const ship of ships)for(const m of ship.mounts){
  if(m.interceptsOnly||['beam','missile','torpedo'].includes(m.kind))continue;
  const ballistic=m.kind==='ballistic'||m.kind==='railgun'||m.projectileKind==='ballistic';
  const resources=gameWeaponValues[m.estimatedFrom?.weaponId??m.weaponId]?.resources??{kind:ballistic?'ballistic':'energy',capacityPerBarrel:ballistic?600:75,estimated:true};
  const capacity=resources.capacityPerBarrel*(m.barrels??1);m.resourceEstimated=resources.estimated;
  if(ballistic){m.ammo=capacity;delete m.capacitor;delete m.ammoReload;}
  else {m.capacitor=capacity;delete m.ammo;delete m.ammoReload;}
 }
 return ships;
}

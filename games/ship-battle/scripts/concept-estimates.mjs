import {readFile} from 'node:fs/promises';
const root=new URL('../src/data/',import.meta.url);
export const conceptRules=JSON.parse(await readFile(new URL('concept-estimation-rules.json',root),'utf8'));
const source=JSON.parse(await readFile(new URL('ship-reference-facts.json',root),'utf8')).ships;
const metadata=JSON.parse(await readFile(new URL('ships.json',root),'utf8'));
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
export function mission(ship){
 const id=ship.id??'',role=(ship.role??metadata.find(s=>s.id===id)?.role??'').toLowerCase();
 if(/^kraken/.test(id)||/fleet carrier|escort carrier|dreadnaught|battle cruiser|destroyer|frigate|corvette|驱逐|护卫/.test(role))return {category:'capital-combat',functional:false};
 if(id==='liberator'||/snub carrier|light carrier/.test(role))return {category:'vehicle-transport',functional:true};
 if(/fighter|战斗机|stealth|interceptor|bomber|gunship|combined arms|electronic warfare|combat|attack|superiority|armored transport|security|军用|巡逻|炮艇|炮舰|战斗|interdiction|boarding|minelayer|military|dropship/.test(role))return {category:/fighter|战斗机|stealth|interceptor/.test(role)?'fighter':'combat-support',functional:false};
 if(/freight|cargo|freighter/.test(role)||/^hull-/.test(id))return {category:'freight',functional:true};
 if(/mining|refining|refinery|construction|salvage/.test(role))return {category:/mining/.test(role)?'mining':/salvage/.test(role)?'salvage':/construction/.test(role)?'construction':'refinery',functional:true};
 if(/repair|refuel|medical/.test(role))return {category:'service',functional:true};
 if(/science/.test(role))return {category:'science',functional:true};
 if(/expedition|exploration|pathfinder/.test(role))return {category:'exploration',functional:true};
 if(/passenger|touring|luxury/.test(role))return {category:'passenger',functional:true};
 if(/transport/.test(role))return {category:'vehicle-transport',functional:true};
 return {category:'civilian-multirole',functional:true};
}
const industrial=new Set(['mining','salvage','construction','refinery','service']);
export function analogue(ship,key='hullTotal'){
 const purpose=mission(ship),length=ship.facts?.length??source[ship.id]?.facts.length??ship.fallbackGeometry?.length??ship.length??21;
 const series=conceptRules.families.find(f=>new RegExp(f.pattern).test(ship.id??''));
 const candidates=metadata.filter(s=>s.id!==ship.id&&source[s.id]?.facts[key]>0&&source[s.id]?.facts.length>0&&mission(s).functional===purpose.functional);
 const score=s=>{
  const group=mission(s),type=group.category===purpose.category?0:industrial.has(group.category)&&industrial.has(purpose.category)?1:3;
  return (s.id===series?.reference?-100:0)+type*5+Math.abs(Math.log(length/source[s.id].facts.length))*2+(s.manufacturer===ship.manufacturer?-.2:0);
 };
 return candidates.sort((a,b)=>score(a)-score(b)||a.id.localeCompare(b.id))[0]??null;
}
/** No recursive estimates: every donor value comes directly from a source fact. */
export function estimateMissingFacts(record){
 const result={...record,facts:{...record.facts}},basis={};
 if(!record.id)return {record:result,basis};
 const length=record.facts.length??record.fallbackGeometry?.length??21;
 for(const [field,power] of Object.entries(conceptRules.lengthPowers)){
  if(record.facts[field]>0)continue;
  const donor=analogue(record,field);if(!donor)continue;
  const f=source[donor.id].facts,ratio=clamp(length/f.length,conceptRules.minimumLengthRatio,conceptRules.maximumLengthRatio);
  result.facts[field]=f[field]*ratio**power;basis[field]={shipId:donor.id,mission:mission(donor).category,lengthRatio:ratio,power};
 }
 if(!(record.facts.shieldRegen>0)){
  const donor=analogue(record,'shieldRegen'),f=donor&&source[donor.id].facts;
  if(f?.shieldCapacity>0){result.facts.shieldRegen=f.shieldRegen*result.facts.shieldCapacity/f.shieldCapacity;basis.shieldRegen={shipId:donor.id,mission:mission(donor).category,capacityRatio:result.facts.shieldCapacity/f.shieldCapacity};}
 }
 return {record:result,basis};
}
